var Promise = require('bluebird');
var AWS = require('aws-sdk');
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var retry = require('bluebird-retry');

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var persistMessageInstance = function(messageInstance) {
    return new Promise(function(resolve,reject) {
        
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
            Item: messageInstance,
            ConditionExpression: "attribute_not_exists(messageInstanceGuid)"
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(messageInstance);
        });
    });
}

var addMessageInstancesToKinesisStream = function(kinesisStreamName, messageInstances) {
    return new Promise(function(resolve,reject) {
        
        //console.log('Adding messages to stream: ' + kinesisStreamName);
        
        if(!messageInstances || messageInstances.length == 0) {
            resolve();
            return;
        }
        
        var params = {
            Records: [],
            StreamName: kinesisStreamName
        };
        
        for( var i = 0; i < messageInstances.length; i++ ) {
            //console.log('InboundMessageInstanceDAO.addMessageInstancesToKinesisStream Adding message to params: ' + JSON.stringify(messageInstance,null,2));
            var messageInstance = messageInstances[i];
            params.Records.push({
                Data: JSON.stringify(messageInstance),
                PartitionKey: messageInstance.messageRequest.syncStreamHashKey || 'default',
                ExplicitHashKey: messageInstance.messageRequest.syncStreamHashKey || 'default'
            });
        }
        
        //console.log('InboundMessageInstanceDAO.addMessageInstancesToKinesisStream Put records to stream.');
        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            if (err) {
                //console.log('InboundMessageInstanceDAO.addMessageInstancesToKinesisStream Error:' + JSON.stringify(err));
                reject(new Error(err))
            }
            else {     
                //console.log('InboundMessageInstanceDAO.addMessageInstancesToKinesisStream Success putting to stream!');
                resolve(data);
            }
        }); 
    });
}

var retryAddMessagesToKinesisStream = function(streamName, messageInstances) {
    var _retryAddMessages = function() {
        return addMessageInstancesToKinesisStream(streamName, messageInstances)
        .then(function(result) {
            if(result.FailedRecordCount != 0) {
                var error = new Error('Error sending some messages to router stream.');
                error.putRecordsResult = result;
                return Promise.reject(error);
            }
            else {
                return Promise.resolve(result);
            }
        });
    }

    return retry(_retryAddMessages, { max_tries: 5, interval: 1000, backoff: 2 });
}

var addMessageInstancesToRouterStream = function(messageInstances) {
    return retryAddMessagesToKinesisStream(EnvironmentConfig.getProperty('collector-v1','KS_MESSAGE_ROUTER_STREAM'), messageInstances);
}

var addMessageInstancesToSyncStream = function(messageInstances) {
    return retryAddMessagesToKinesisStream(EnvironmentConfig.getProperty('collector-v1','KS_SYNC_MESSAGE_STREAM'), messageInstances);
}

var create = function(orgInternalName, facilityId, messageRequest, flow ) {

        if( !messageRequest.messageRequestGuid )
            throw new Error('Unable to create new message instance, message request missing GUID.');

        // We create a copy of the message request and remove the content from it before
        // persisting it and returning it in this method.
        var clonedMessageRequest = JSON.parse(JSON.stringify(messageRequest));
        clonedMessageRequest.messageContent = null;

        var inboundMessageInstance = {
            messageInstanceGuid: uuid.v4(), // Generate a new GUID
            processingOrderType: flow.processingOrderType,
            orgInternalName: orgInternalName,
            facilityId: facilityId,
            messageRequest: clonedMessageRequest,
            flowGuid: flow.flowGuid,
            messageInstanceCreated: new Date().getTime(),
            processingStatus: 'pending',
            failureTimes: [],
            failedAttempts: 0
        };
        
        // Persist the message to DynamoDB
        return persistMessageInstance(inboundMessageInstance);
}

function getMessageInstancesForFlow(flowGuid) {
    return new Promise(function(resolve,reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
            IndexName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES_FLOWGUID_IDX'),
            KeyConditionExpression: "flowGuid = :flowGuid and messageInstanceCreated > :messageInstanceCreated",
            ScanIndexForward: false,
            ExpressionAttributeValues: {
                ":messageInstanceCreated": 0,
                ":flowGuid": flowGuid
            }
        };

        var docClient = createDynamoDbDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
        
    });
}

module.exports = {
  
    // We only expose this for testing. This should not be used outside of this module.
    _persistMessageInstance: persistMessageInstance, 
  
    createInstancesForFlows: function(orgInternalName, facilityId, messageRequest, flows ) {

        return Promise.resolve(flows)
        .mapSeries(function(flow) { 
            return create(orgInternalName, facilityId, messageRequest, flow ); 
        });
    },
    
    getMessageInstance: function(messageInstanceGuid) {
        return new Promise(function(resolve,reject) {

            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                Key: {
                    "messageInstanceGuid": messageInstanceGuid,
                },
                ConsistentRead: true
            };

            var docClient = createDynamoDbDocClient();
            docClient.get(params, function(err, data) {
                if (err) reject(err);
                else resolve(data.Item);
            });
        });
    },
    
    indicateFailedProcessingAttempt: function(messageInstanceGuid, data, tl) {
        return new Promise(function(resolve,reject) {
            var now = Date.now();
            
            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                Key: {
                    "messageInstanceGuid": messageInstanceGuid,
                },
                AttributeUpdates: {
                    failureTimes: { Action: "ADD", Value: [Date.now()] },
                    failedAttempts: { Action: "ADD", Value: 1 },
                    processingStatus: { Action: "PUT", Value: 'failed_pending_retry' }
                },
                Expected: {
                    messageInstanceGuid: {
                        Value: messageInstanceGuid,
                        Exists: true
                    }
                },
                ReturnValues: "ALL_NEW"

                /*
                Not sure why, but for some reason, the following does not work but
                the legacy attributes above do?
                
                ConditionExpression: "attribute_exists(messageInstanceGuid)",
                UpdateExpression: 'ADD failedAttempts :failureIncrement, failureTimes :now SET messageInstanceStatus = :messageInstanceStatus',
                ExpressionAttributeValues: {
                    ':failureIncrement' : 1,
                    ':now' : [Date.now()],
                    ':messageInstanceStatus' : 'failed_pending_retry'
                }
                */
            };
            
            if(data && data.streamShardId) params.AttributeUpdates.streamShardId = { Action: "PUT", Value: data.streamShardId };
            if(data && data.streamHashKey) params.AttributeUpdates.streamHashKey = { Action: "PUT", Value: data.streamHashKey };
            if(data && data.streamPartitionKey) params.AttributeUpdates.streamPartitionKey = { Action: "PUT", Value: data.streamPartitionKey };

            if(tl) tl.logInfo('UPDATE_DDB_STATUS', 'Updating DDB status.', {params:params});

            var docClient = createDynamoDbDocClient();
            docClient.update(params, function(err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    if(tl) tl.logInfo('UPDATE_DDB_SUCC', 'DDB updated.', {ddbReturnData:data});
                    resolve(messageInstanceGuid);
                }
            });
        });
    },
    
    indicateSuccessfulProcessing: function(messageInstanceGuid, data) {
        return new Promise(function(resolve,reject) {

            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                Key: {
                    "messageInstanceGuid": messageInstanceGuid,
                },
                AttributeUpdates: {
                    succeededTime: { Action: "PUT", Value: Date.now() },
                    processingStatus: { Action: "PUT", Value: 'succeeded' }
                },
                Expected: {
                    messageInstanceGuid: {
                        Value: messageInstanceGuid,
                        Exists: true
                    }
                }
            };
            
            if(data && data.streamShardId) params.AttributeUpdates.streamShardId = { Action: "PUT", Value: data.streamShardId };
            if(data && data.streamHashKey) params.AttributeUpdates.streamHashKey = { Action: "PUT", Value: data.streamHashKey };
            if(data && data.streamPartitionKey) params.AttributeUpdates.streamPartitionKey = { Action: "PUT", Value: data.streamPartitionKey };

            var docClient = createDynamoDbDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(messageInstanceGuid);
            });
        });
    },
    

    indicateFailedRouting: function(messageInstanceGuids) {
        return Promise.mapSeries(messageInstanceGuids, function(messageInstanceGuid) {
            return new Promise(function(resolve,reject) {

                var params = {
                    TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                    Key: {
                        "messageInstanceGuid": messageInstanceGuid,
                    },
                    AttributeUpdates: {
                        processingStatus: { Action: "PUT", Value: 'routing_failed' }
                    },
                    Expected: {
                        messageInstanceGuid: {
                            Value: messageInstanceGuid,
                            Exists: true
                        }
                    }
                };

                var docClient = createDynamoDbDocClient();
                docClient.update(params, function(err, data) {
                    if (err) reject(err);
                    else resolve(messageInstanceGuid);
                });
            });
        });
    },
    
    // Returns an object with properties for the messageInstanceGuid and processingStatus if the object is found,
    // if the object is not found it returns null. Otherwise if an error returns it rejects the promise.
    getMessageInstanceStatus: function(messageInstanceGuid) {
        return new Promise(function(resolve,reject) {
            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                Key: {
                    "messageInstanceGuid": messageInstanceGuid,
                },
                AttributesToGet: [
                    "processingStatus",
                    "messageInstanceGuid"
                ],
                ConsistentRead: true
            };

            var docClient = createDynamoDbDocClient();
            docClient.get(params, function(err, data) {
                if (err ) {
                    reject(err);  
                } 
                else if(data && !data.Item) {
                    resolve(null);
                }
                else {
                    resolve(data.Item);   
                }
            });
        });
    },
    
    getMessageInstancesForRequest: function(messageRequestGuid) {
        return new Promise(function(resolve,reject) {

            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_INSTANCES'),
                IndexName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_MESSAGE_MESSAGEREQUESTGUID_IDX'),
                KeyConditionExpression: "messageRequestGuid = :messageRequestGuid",
                ExpressionAttributeValues: {
                    ":messageRequestGuid": messageRequestGuid,
                },
                ConsistentRead: true
            };

            var docClient = createDynamoDbDocClient();
            docClient.query(params, function(err, data) {
                if (err) reject(err);
                else resolve(data.Items);
            });
            
        });
    },
    
    addMessageInstancesToRouterStream: addMessageInstancesToRouterStream,
    addMessageInstancesToSyncStream: addMessageInstancesToSyncStream,
    addMessageInstancesToAsyncQueue: addMessageInstancesToSyncStream, // TODO Implement, for now we just send them to the stream.
    getMessageInstancesForFlow: getMessageInstancesForFlow
}