module.exports = function apiGwKey (arc, cloudformation, stage) {
  cloudformation.Resources.AuthKey = {
    Type: 'AWS::ApiGateway::ApiKey',
    DependsOn: [
      'BcToken',
      `BcToken${stage}Stage`
    ],
    Properties: {
      Name: 'BC',
      Description: 'BC key',
      Enabled: true,
      StageKeys: [{
        RestApiId: {
          Ref: 'BcToken'
        },
        StageName: stage
      }]
    }
  }

  cloudformation.Resources.AuthKeyUsagePlan = {
    Type: 'AWS::ApiGateway::UsagePlan',
    Properties: {
      ApiStages: [{
        ApiId: { Ref: 'BcToken' },
        Stage: stage
      }],
      Description: 'BC key usage plan',
      UsagePlanName: 'BC usage plan'
    }
  }

  cloudformation.Resources.AuthKeyUsagePlanKey = {
    Type: 'AWS::ApiGateway::UsagePlanKey',
    Properties: {
      KeyId: { Ref: 'AuthKey' },
      KeyType: 'API_KEY',
      UsagePlanId: { Ref: 'AuthKeyUsagePlan' }
    }
  }

  cloudformation.Resources.BcToken.Properties.Auth = { ApiKeyRequired: true }

  cloudformation.Resources.GetIndex.Properties
    .Events.GetIndexEvent.Properties.Auth = {
      ApiKeyRequired: true
    }

  return cloudformation
}
