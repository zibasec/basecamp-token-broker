const querystring = require('querystring')
const fetch = require('node-fetch')
const chromium = require('chrome-aws-lambda')
const debug = require('debug')('bc-token')

exports.handler = async function http (req) {
  console.time('bc')
  const requiredEnvVars = [
    'CLIENT_ID',
    'CLIENT_SECRET',
    'BOT_EMAIL',
    'BOT_PASSWORD',
    'REDIRECT_URL'
  ]

  const missing = []
  requiredEnvVars.map(k => {
    if (!process.env[k]) {
      missing.push(`missing environment variable "${k}"`)
    }
  })

  if (missing.length > 0) {
    return {
      statusCode: 400,
      body: missing.join(', ')
    }
  }

  const browser = await chromium.puppeteer.launch({
    executablePath: await chromium.executablePath,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    headless: true
  })

  const page = await browser.newPage()

  const clientId = process.env.CLIENT_ID
  const initQuery = {
    type: 'web_server',
    client_id: clientId,
    redirect_uri: process.env.REDIRECT_URL
  }

  const url = `https://launchpad.37signals.com/authorization/new?${querystring.stringify(initQuery)}`
  debug(`Going to ${url}`)
  await page.goto(url)

  debug('waiting for basecamp login page')
  await page.waitForSelector("input[id='username']", { visible: true })

  debug('inserting robot email')
  await page.type("input[id='username']", process.env.BOT_EMAIL)

  debug('hitting enter')
  await page.keyboard.press('Enter')

  await page.waitForSelector('input[type="password"]', { visible: true })

  debug('adding password')
  await page.focus('input[id="password"]')
  await page.keyboard.type(process.env.BOT_PASSWORD)
  debug('typed in password')

  await page.keyboard.press('Enter')
  await page.waitForNavigation({ waitUntil: 'networkidle0' })

  await page.waitForSelector('button[name="commit"]', { visible: true })
  debug('giving ada permission')
  const allowButton = await page.$('button[name="commit"]')
  allowButton.click(allowButton)
  await page.waitForNavigation({ waitUntil: 'networkidle0' })

  debug('grabbing the code from the query string in the url bar')
  const code = await page.evaluate(async () =>
    ((new URL(document.location)).searchParams).get('code')
  )

  const clientSecret = process.env.CLIENT_SECRET
  const tokenQuery = {
    ...initQuery,
    client_secret: clientSecret,
    code
  }

  const getToken = `https://launchpad.37signals.com/authorization/token?${querystring.stringify(tokenQuery)}`

  const requestOptions = {
    method: 'post',
    headers: { 'Content-Type': 'application/json' }
  }
  debug('requesting access token from basecamp')
  const res = await fetch(getToken, requestOptions)
  if (!res.ok) {
    console.error({ res })
    return {
      statusCode: 400
    }
  }

  const data = await res.json()
  await browser.close()
  debug('done')
  console.timeEnd('bc')
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }
}
