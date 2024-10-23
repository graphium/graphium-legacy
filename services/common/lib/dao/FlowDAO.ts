import * as AWS from 'aws-sdk';
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var _ = require('lodash');
import * as Joi from 'joi';
var ddb = require('../util/ddbUtil.js');
import Flow from '../model/flow/Flow.js';
import * as Bluebird from 'bluebird';
import { EnvironmentConfig } from '../config/EnvironmentConfig';
var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

export function updateFlow(flow) {

    var flowConfig = flow.flowConfig;
    delete flow.flowConfig;

    var schema = {
        flowGuid: Joi.string().guid().required(),
        flowName: Joi.string(),
        flowDescription: Joi.string().optional().allow(null),
        facilityId: Joi.when('systemGlobal', {
            is: true,
            then: Joi.allow(null),
            otherwise: Joi.number().integer()
        }),
        streamType: Joi.string().required(),
        messageTypes: Joi.array().items(Joi.string()).required(),
        flowType: Joi.string().valid(['script','system']).required(),
        flowContent: Joi.string().required(),
        scriptLanguage: Joi.string().valid(['javascript','typescript']).optional(),
        runtimeVersion: Joi.string().valid(['1.0.0','1.1.0']).optional(),
        defaultHandler: Joi.string().optional().allow(null),
        timeout: Joi.number().integer().min(5).max(1200),
        flowConfig: Joi.any().forbidden(),
        active: Joi.boolean().required(),
        // We only allow systemGlobal to be set to true when stream type is collector,
        // otherwise we only allow false, null or undefined.
        systemGlobal: Joi.when('streamType', {
            is: 'collector',
            then: Joi.boolean().allow(null),
            otherwise: Joi.allow(false, null)
        })
    }

    var validationResult = Joi.validate(flow, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var errors = _.map(validationResult.error.details, function(detail) { return '(' + detail.path + ')' + detail.message;});
        var error = new Error('Unable to create flow, invalid flow property: ' + errors.join(', '));
        console.error(validationResult.error);
        error["validationError"] = validationResult.error;
        return Promise.reject(error);
    }

    var p;
    if( flowConfig ) {
        p = encryptFlowConfig(flowConfig);
    }
    else {
        p = Promise.resolve(null);
    }

    return p.then(function(flowConfigCipher) {
        return new Promise(function(resolve, reject) {

            /*
            var AttributeUpdates:any = {
                flowName: { Action: "PUT", Value: flow.flowName },
                flowDescription: { Action: "PUT", Value: flow.flowDescription },
                scriptLanguage: { Action: "PUT", Value: flow.scriptLanguage },
                runtimeVersion: { Action: "PUT", Value: flow.runtimeVersion },
                defaultHandler: { Action: "PUT", Value: flow.defaultHandler },
                streamType: { Action: "PUT", Value: flow.streamType },
                messageTypes: { Action: "PUT", Value: flow.messageTypes },
                flowType: { Action: "PUT", Value: flow.flowType },
                flowContent: { Action: "PUT", Value: flow.flowContent },
                timeout: { Action: "PUT", Value: flow.timeout },
                active: { Action: "PUT", Value: flow.active },
                lastUpdatedAt: { Action: "PUT", Value: Date.now() },
                version: { Action: "ADD", Value: 1 }
            };

            if(flow.facilityId != null)
                AttributeUpdates.facilityId = { Action: "PUT", Value: flow.facilityId };
            if(flowConfigCipher)
                AttributeUpdates.flowConfigCipher = { Action: "PUT", Value: flowConfigCipher };
            */

            var params = {
                TableName: EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'),
                Key: {
                    flowGuid: flow.flowGuid,
                },
                ConditionExpression: 'attribute_exists(flowGuid)',
                ExpressionAttributeValues: undefined,
                UpdateExpression: undefined
            };
            var setExpressions = [

                'flowName = :flowName',
                'flowDescription = :flowDescription',
                'scriptLanguage = :scriptLanguage',
                'runtimeVersion = :runtimeVersion',
                'defaultHandler = :defaultHandler',
                'streamType = :streamType',
                'messageTypes = :messageTypes',
                'flowType = :flowType',
                'flowContent = :flowContent', 
                'timeout = :timeout',
                'active = :active', 
                'lastUpdatedAt = :now'
            ];
            var addExpressions = [
                'version :one'
            ];
            var deleteExpressions = [
            ];

            params.ExpressionAttributeValues = {
                ':flowName': flow.flowName,
                ':flowDescription': flow.flowDescription,
                ':scriptLanguage': flow.scriptLanguage,
                ':runtimeVersion': flow.runtimeVersion,
                ':defaultHandler': flow.defaultHandler,
                ':messageTypes': flow.messageTypes,
                ':flowType': flow.flowType,
                ':streamType': flow.streamType, 
                ':flowContent': flow.flowContent, 
                ':timeout': flow.timeout,
                ':active': flow.active,
                ':now': new Date().getTime(),
                ':one': 1
            }

            // If system global is set to true, then we make sure and remove org internal name from the object in case
            // this update is updating this template from org specific to global.
            if(flow.systemGlobal) {
                deleteExpressions.push('orgInternalName','facilityId');
            }
            // If system global is set to 'false' in the update, we only allow this update if system global is already null
            // or false. Otherwise you could make a template that is currently global, org specific. Once it is global it will
            // always be global.
            else {
                params.ConditionExpression += ' and (attribute_not_exists(systemGlobal) or systemGlobal = :false)';
                params.ExpressionAttributeValues[':false'] = false;
            }

            if(flow.facilityId != null && !flow.systemGlobal) {
                setExpressions.push('facilityId = :facilityId');
                params.ExpressionAttributeValues[':facilityId'] = flow.facilityId;
            }
            
            if(flowConfigCipher) {
                setExpressions.push('flowConfigCipher = :flowConfigCipher');
                params.ExpressionAttributeValues[':flowConfigCipher'] = flowConfigCipher;
            }
            
            params.UpdateExpression = 
                (setExpressions.length > 0 ? 'SET ' + setExpressions.join(', ') : '')
                + (addExpressions.length > 0 ? ' ADD ' + addExpressions.join(', ') : '')
                + (deleteExpressions.length > 0 ? ' DELETE ' + deleteExpressions.join(', ') : '');

            var docClient = createDynamoDbDocClient();
            docClient.update(params, function(err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(null);
                }
            });
        });    
    });
}

export function updateFlowConfig(flowGuid, flowConfig) {
    
    return encryptFlowConfig(flowConfig)
    .then(function(flowConfigCipher) {
        return new Promise(function(resolve, reject) {
            var params = {
                TableName: EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'),
                Key: {
                    "flowGuid": flowGuid,
                },
                AttributeUpdates: {
                    flowConfigCipher: { Action: "PUT", Value: flowConfigCipher }
                },
                Expected: {
                    flowGuid: {
                        Value: flowGuid,
                        Exists: true
                    }
                }
            };
            
            var docClient = createDynamoDbDocClient();
            docClient.update(params, function(err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(null);
                }
            });
        });    
    });
}

var retrieveFlow = function(flowGuid):Promise<Flow> {
    return new Promise<Flow>(function(resolve,reject) {
        var params = {
            TableName : EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'),
            Key: {
                'flowGuid': flowGuid
            },
            ConsistentRead: true
        };

        var docClient = createDynamoDbDocClient();
        docClient.get(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Item as Flow);
        });
    });
}

export function createFlow(flow) {

    if(!flow.flowGuid) {
        flow.flowGuid = uuid.v4();
    }
    flow.createdAt = Date.now();
    flow.lastUpdatedAt = Date.now();
    flow.active = true;
    flow.version = 0;

    var flowConfig;
    if(flow.flowConfig) {
        flowConfig = flow.flowConfig;
        delete flow.flowConfig;
    }

    var schema = {
        flowGuid: Joi.string().guid().required(),
        flowName: Joi.string(),
        flowDescription: Joi.string().optional().allow(null),
        orgInternalName: Joi.when('systemGlobal', {
            is: true,
            then: Joi.allow(null),
            otherwise: Joi.string().required()
        }),
        facilityId: Joi.when('systemGlobal', {
            is: true,
            then: Joi.allow(null),
            otherwise: Joi.number().integer()
        }),
        scriptLanguage: Joi.string().valid(['javascript','typescript']).optional(),
        runtimeVersion: Joi.string().valid(['1.0.0','1.1.0']).optional(),
        defaultHandler: Joi.string().optional().allow(null),
        streamType: Joi.string().required(),
        messageTypes: Joi.array().items(Joi.string()).required(),
        processingOrderType: Joi.string().valid(['sync']).required(),
        flowType: Joi.string().valid(['script','system']).required(),
        flowContent: Joi.string().required(),
        timeout: Joi.number().integer().min(5).max(1200),
        createdAt: Joi.number().required(),
        lastUpdatedAt: Joi.number().required(),
        flowConfig: Joi.any().forbidden(),
        version: Joi.number().integer().required(),
        active: Joi.boolean().required(),
        // We only allow systemGlobal to be set to true when stream type is collector,
        // otherwise we only allow false, null or undefined.
        systemGlobal: Joi.when('streamType', {
            is: 'collector',
            then: Joi.boolean().allow(null),
            otherwise: Joi.allow(false, null)
        })
    }

    var validationResult = Joi.validate(flow, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var error = new Error('Unable to create flow, invalid flow property.');
        console.error(validationResult.error);
        error["validationError"] = validationResult.error;
        return Promise.reject(error);
    }

    return ddb.putUnique(EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'), flow, "flowGuid")
    .then(function(flowResult) {
        if(flowConfig && _.isPlainObject(flowConfig)) {
            return updateFlowConfig(flow.flowGuid, flowConfig)
        }
        else {
            return Promise.resolve(null);
        }
    })
    .then(function() {
        flow.flowConfig = flowConfig;
        return Promise.resolve(flow);
    })
}

export function getSystemFlowScripts() {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_SYSTEM_FLOW_SCRIPTS')
        };

        var docClient = createDynamoDbDocClient();
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.Items);
            } 
        });
    });
}

export function retrieveSystemFlowScriptByName(systemFlowScriptName) {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_SYSTEM_FLOW_SCRIPTS'),
            IndexName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_SYSTEM_FLOW_SCRIPTS_NAME_IDX'),
            FilterExpression : 'systemFlowScriptName = :systemFlowScriptName',
            ExpressionAttributeValues : {':systemFlowScriptName' : systemFlowScriptName}
        };

        var docClient = createDynamoDbDocClient();
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                if(_.isEmpty(data) || _.isEmpty(data.Items))
                    reject(new Error('SystemFlowScript not found for specified systemFlowScriptName.'));
                else if( data.Items.length > 1 )
                    reject(new Error('Found more than one system flow script with that name.'));
                else
                    resolve(data.Items[0]);
            } 
        });
    });
}

var kmsEncrypt = async function(params):Promise<AWS.KMS.EncryptResponse> {
    return new Promise<AWS.KMS.EncryptResponse>((resolve, reject) => {
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.encrypt(params, (err, data) => {
            if(err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    })
}

var encryptFlowConfig = async function(flowConfig):Promise<string> {
        
    if( !flowConfig ) {
        return null;
    }
    
    var params = {
        KeyId: 'alias/flow/'+EnvironmentConfig.environment+'/flowConfig',
        Plaintext: JSON.stringify(flowConfig)
    };
    
    var encryptResponse = await kmsEncrypt(params);
    var buffer = encryptResponse.CiphertextBlob as Buffer;
    return buffer.toString('base64');
}

var decryptFlowConfig = function(flowConfigCipher) {
    return new Promise(function(resolve, reject) {
        
        if( !flowConfigCipher ) {
            resolve({});
            return;
        }
        
        var params = {
            CiphertextBlob: new Buffer(flowConfigCipher, 'base64')
        };
        
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.decrypt(params, function(err, data) {
            
            if (err) { 
                reject(err); // an error occurred
            }
            else {
                var flowConfig = {};     
                var jsonString = data.Plaintext.toString();
                if(!jsonString)
                    return {};
                    
                try {
                    flowConfig = JSON.parse(jsonString); 
                }
                catch(error) {
                    flowConfig = {};
                }
                
                resolve(flowConfig);
            }
        });
    });
}

export function getFlowsForMessage(orgInternalName, facilityId, streamType, messageType) {
    return ddb.scanAll(
        EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'), 
        "active = :active and orgInternalName = :orgInternalName and facilityId = :facilityId and streamType = :streamType and contains(messageTypes, :messageType)", 
        {
            ":orgInternalName": orgInternalName,
            ":facilityId": parseInt(facilityId),
            ":streamType": streamType,
            ":messageType": messageType.toString(),
            ":active": true
        }, 
        {
            ConsistentRead: true,
            ProjectionExpression: "processingOrderType, flowGuid, active"
        }
    );
}

export function getFlowsForScheduledMessage(scheduleType) {
    return ddb.scanAll(
        EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'), 
        "active = :active and streamType = :streamType and contains(messageTypes, :messageType)", 
        {
            ":streamType": "scheduled",
            ":messageType": scheduleType,
            ":active": true
        }, 
        {
            ConsistentRead: true,
            ProjectionExpression: "flowGuid, facilityId, flowName, orgInternalName"
        }
    );
}

export function getFlowsForOrg(orgInternalName, projectAll) {
    console.log('Returning flows for org: ' + orgInternalName);
    return ddb.scanAll(
        EnvironmentConfig.getProperty('flow-script-v1','DDB_TABLE_FLOW_CONFIGS'), 
        "active = :active and (orgInternalName = :orgInternalName or systemGlobal = :true)", 
        {
            ":orgInternalName": orgInternalName,
            ":true": true,
            ":active": true
        }, 
        {
            ProjectionExpression: projectAll ? undefined : "flowGuid, facilityId, flowName, version, streamType, orgInternalName, systemGlobal"
        }
    );
}

export async function getFlow(flowGuid):Promise<Flow> {

    var flow = await retrieveFlow(flowGuid);

    if(!flow) {
        throw new Error('Unable to find flow with the specified ID.');
    }

    if(flow.flowType == 'system') {       
        flow.systemFlowScript = flow.flowContent;    
        flow.systemFlowScriptContent = await retrieveSystemFlowScriptByName(flow.flowContent);
        flow.flowContent = flow.systemFlowScriptContent.flowContent;
    }

    flow.flowConfig = await decryptFlowConfig(flow.flowConfigCipher);
    return flow;
}

export async function getFlowOrg(flowGuid):Promise<string> {
    var flow = await retrieveFlow(flowGuid);

    if(!flow) {
        throw new Error('Unable to find flow with the specified ID.');
    }

    return flow.orgInternalName;
}
