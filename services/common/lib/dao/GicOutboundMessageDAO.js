var Promise = require('bluebird');
var uuid = require('uuid');
var AWS = require('aws-sdk');
var pako = require('pako');
var winston = require('winston');
var _ = require('lodash');
var https = require('https');
var ddbUtil = require('../util/ddbUtil.js');

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var saveContentToS3 = function(gicOutboundMessageGuid, messageContent) {
    return new Promise(function(resolve,reject) {
        
        if( !messageContent ) {
            reject('Cannot persist message content to S3, message content empty.');
            return;
        }
        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        var messageContentString = JSON.stringify(messageContent);
        var gzippedContent = pako.deflate(messageContentString, {to:'string'});
        
        // First we determine if the object already exists. This is expensive to
        // do, I wish we had a better way, but for now we will see how it impacts
        // message throughput.
        s3.headObject({
            Bucket: process.env.S3_MESSAGE_INSTANCE_BUCKET,
            Key: gicOutboundMessageGuid
        },
        function(headObjectErr, headObjectData) {
            
            if( headObjectErr && headObjectErr.code == "NotFound" ) {

                s3.putObject({
                    Bucket: process.env.S3_GIC_OUTBOUND_MESSAGES_BUCKET,
                    Key: gicOutboundMessageGuid,
                    ACL: "bucket-owner-full-control",
                    Body: gzippedContent,
                    SSEKMSKeyId: process.env.S3_SSE_KEY_ID,
                    ServerSideEncryption: "aws:kms",
                    StorageClass: "STANDARD"
                }, 
                function(err, data) {
                    if(err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    } 
                });
            }
            // We have received an error from the service, so let's bail this
            // DAO and return an error to the system.
            else {
                reject(new Error(headObjectErr ? "Unable to check for existing message in S3: " + headObjectErr.code : "S3 message with that key already exists."));
            }
        });
    });
}

var persistDdbMessage = function(gicOutboundMessage) {
    return new Promise(function(resolve,reject) {
        var params = {
            TableName: process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
            Item: gicOutboundMessage,
            ConditionExpression: "attribute_not_exists(gicOutboundMessageGuid)"
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(gicOutboundMessage);
        });
    });
}


var retrieveDdbMessage = function(gicOutboundMessageGuid) {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
            Key: {
                gicOutboundMessageGuid: gicOutboundMessageGuid   
            },
            ConsistentRead: true
        };

        var docClient = createDynamoDbDocClient();
        docClient.get(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                if(_.isEmpty(data) || _.isEmpty(data.Item))
                    reject(new Error('GicOutboundMessage not found for specified gicOutboundMessageGuid.'));
                else
                    resolve(data.Item);
            }
        });
    });
}


var retrieveMessageContentFromS3 = function(gicOutboundMessage) {
    return new Promise(function(resolve, reject) {        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        s3.getObject({
            Bucket: process.env.S3_GIC_OUTBOUND_MESSAGES_BUCKET,
            Key: gicOutboundMessage.gicOutboundMessageGuid
        }, 
        function(err, data) {
            if(err) {
                console.error('Unable to retrieve outbound message content from S3: ' + err);
                reject(err);
            }
            else {
                var body = data.Body.toString();
                resolve(JSON.parse(pako.inflate(body,{to:'string'})));
            }
        });
    });
}

var retrieveMessage = function(gicOutboundMessageGuid, withContent) {
    
    var message;
    return retrieveDdbMessage(gicOutboundMessageGuid)
    .then(function(gicOutboundMessage) {
        message = gicOutboundMessage;
        
        if(withContent) {
            return retrieveMessageContentFromS3(gicOutboundMessage)
            .then(function(messageContent) {
                message.messageContent = messageContent;
                return Promise.resolve(message); 
            });
        }
        else {
            return Promise.resolve(message);
        }
    });
}

/*
pending - Message has been added to the queue and is awaiting next polling interval to be sent to EMR.
sent_pending_ack - Message has been sent to EMR, awaiting ack.
failed_pending_retry - Message has received an ack but error was indicated. Will attempt to resend.
failed - Message has failed and exceeded the retry attempts.
succeeded - Message was successfully sent to the EMR.
*/

var indicateSentToEmr = function(gicOutboundMessageGuid) {
    return new Promise(function(resolve,reject) {
        var now = Date.now();
        
        var params = {
            TableName: process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
            Key: {
                "gicOutboundMessageGuid": gicOutboundMessageGuid,
            },
            AttributeUpdates: {
                processingStatus: { Action: "PUT", Value: 'sent_pending_ack' }
            },
            Expected: {
                gicOutboundMessageGuid: {
                    Value: gicOutboundMessageGuid,
                    Exists: true
                }
            }
        };

        var docClient = createDynamoDbDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(gicOutboundMessageGuid);
        });
    });
}

var indicateAckError = function(gicOutboundMessageGuid, reason) {
    
    return retrieveDdbMessage(gicOutboundMessageGuid)
    .then(function(outboundMessage) {
        return new Promise(function(resolve,reject) {
            
            var status = outboundMessage.failedAttempts >= 2 ? 'failed' : 'failed_pending_retry';
            
            if(!reason) reason = "Unspecified";
            
            var params = {
                TableName: process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
                Key: {
                    "gicOutboundMessageGuid": gicOutboundMessageGuid,
                },
                AttributeUpdates: {
                    failureTimes: { Action: "ADD", Value: [Date.now()] },
                    failedAttempts: { Action: "ADD", Value: 1 },
                    failureReasons: { Action: "ADD", Value: [reason] },
                    processingStatus: { Action: "PUT", Value: status }
                },
                Expected: {
                    gicOutboundMessageGuid: {
                        Value: gicOutboundMessageGuid,
                        Exists: true
                    }
                }
            };
            
            var docClient = createDynamoDbDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(gicOutboundMessageGuid);
            });
        });
    });
}
    
var indicateAckSuccess = function(gicOutboundMessageGuid) {

    return new Promise(function(resolve,reject) {
        var now = Date.now();
        var params = {
            TableName: process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
            Key: {
                "gicOutboundMessageGuid": gicOutboundMessageGuid,
            },
            AttributeUpdates: {
                processingStatus: { Action: "PUT", Value: 'succeeded' },
                succeededTime: { Action: "PUT", Value: now }
            },
            Expected: {
                gicOutboundMessageGuid: {
                    Value: gicOutboundMessageGuid,
                    Exists: true
                }
            }
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(gicOutboundMessageGuid);
        });
    });
}

var retrievePendingFailedMessages = function(systemId, limit) {

    return ddbUtil.queryAll(
        process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
        process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES_PROCESSINGSTATUS_IDX,
        "processingStatus = :processingStatus",
        {
            ":processingStatus": 'failed_pending_retry'
        }
    )
    .then(function(allMessages) {
        var systemMessages = _.take(_.orderBy(_.filter(allMessages, function(m) { return m.systemId == systemId; }),['created'],['asc']),limit);
        return systemMessages;
    });
}

var retrievePendingMessages = function(systemId, limit) {
    // We do not use the DDB limit with a filter expression since the filter
    // is applied AFTER the limit. This means that we are missing messages from the system
    // if the total number of pending messages exceeds the limit. Therefore we pull ALL
    // pending messages and then filter based on system ID. We also order them in ascending order
    // so that the oldest messages (smallest timestamp) get sent out first.
    return ddbUtil.queryAll(
        process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES,
        process.env.DDB_TABLE_GIC_OUTBOUND_MESSAGES_PROCESSINGSTATUS_IDX,
        "processingStatus = :processingStatus",
        {
            ":processingStatus": 'pending'
        }
    )
    .then(function(allMessages) {
        var systemMessages = _.take(_.orderBy(_.filter(allMessages, function(m) { return m.systemId == systemId; }),['created'],['asc']),limit);
        return systemMessages;
    });
}

var appendMessageContents = function(messages) {
    return Promise.map(messages, function(message) {
        return retrieveMessageContentFromS3(message)
        .then(function(messageContent) {
            message.messageContent = messageContent;
            return Promise.resolve(message);
        })
        .catch(function(error) {
            if(error.code == 'NoSuchKey') {
                console.warn('Attempted to retrieve content for GicOutboundMessage but S3 content does not exist.');
                return Promise.resolve();
            }
            else {
                return Promise.reject(error);
            }
        });
    },{concurrency: 15})
    .then(function(messagesWithContent) {
        // We cleanup the array to get rid of the null values we inserted
        // when the 'NoSuchKey' errors were caught.
        return Promise.resolve(_.compact(messagesWithContent));
    });
}

var retrieveAllPendingMessages = function(systemId, withContent, limit) {
    var allMessages = [];
    return retrievePendingMessages(systemId, limit)
    .then(function(pendingMessages) {
        allMessages = allMessages.concat(pendingMessages);
        return retrievePendingFailedMessages(systemId, limit);
    })
    .then(function(pendingFailedMessages) {
        allMessages = _.sortBy(allMessages.concat(pendingFailedMessages),['created']);
        
        if(withContent) {
            return appendMessageContents(allMessages);
        }
        else {
            return Promise.resolve(allMessages);
        }
    });
}

module.exports = {  
  // Creates a new message object by creating a GUID for the message and then
  // storing the message request in S3.
  create: function( gicOutboundMessage ) {

    if(!gicOutboundMessage.systemId ||
        !gicOutboundMessage.messageContent ||
        !_.isInteger(gicOutboundMessage.messageType) ||
        !gicOutboundMessage.orgInternalName )
        return Promise.reject(new Error('Unable to create new GIC message, message object missing required properties or properties in incorrect format.'));

    gicOutboundMessage.gicOutboundMessageGuid = uuid.v4();
    gicOutboundMessage.messageContent.MessageID = gicOutboundMessage.gicOutboundMessageGuid;
    
    return saveContentToS3(gicOutboundMessage.gicOutboundMessageGuid, gicOutboundMessage.messageContent)
    .then( function(s3Object) {
        
        var clonedMessage = JSON.parse(JSON.stringify(gicOutboundMessage));
        clonedMessage.messageContent = null;
        clonedMessage.created = new Date().getTime();
        clonedMessage.processingStatus = 'pending';
        clonedMessage.failureTimes = [];
        clonedMessage.failedAttempts = 0;
        clonedMessage.failureReasons = [];
        
        return persistDdbMessage(clonedMessage);
    });
  },
  
  getMessage: retrieveMessage,
  getMessageContent: retrieveMessageContentFromS3,
  indicateAckError: indicateAckError,
  indicateAckSuccess: indicateAckSuccess,
  indicateSentToEmr: indicateSentToEmr,
  retrieveAllPendingMessages: retrieveAllPendingMessages,
  appendMessageContents: appendMessageContents
};