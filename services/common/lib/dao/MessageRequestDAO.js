import { EnvironmentConfig } from '../config/EnvironmentConfig';

var Promise = require('bluebird');
var uuid = require('uuid');
var AWS = require('aws-sdk');
var pako = require('pako');
var winston = require('winston');
var _ = require('lodash');
var https = require('https');

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var saveContentToS3 = function(messageRequestGuid, messageContent) {
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

        // ddura 5/13/20: We are removing the head call. Turns out that making a HEAD request
        // prior to a GET requests means that the GET request may not be consistent. See docs
        // here: https://docs.aws.amazon.com/AmazonS3/latest/dev/Introduction.html#ConsistencyModel
        // 
        //     "Amazon S3 provides read-after-write consistency for PUTS of new objects in your S3 bucket in all Regions with one caveat. 
        //      The caveat is that if you make a HEAD or GET request to a key name before the object is created, then create the object shortly 
        //      after that, a subsequent GET might not return the object due to eventual consistency. "
        // 
        // For now we will remove this check. The call to actually create the DDB object (which happens)
        // after this also has a condition check on whether the GUID exists. If that fails, we will have an
        // orphaned S3 object which is a fair tradeoff. There will not be an orphaned DDB object.

        //s3.headObject({
        //    Bucket: EnvironmentConfig.getProperty('collector-v1','S3_MESSAGE_INSTANCE_BUCKET'),
        //    Key: messageRequestGuid
        //},
        //function(headObjectErr, headObjectData) {
            
        //    if( headObjectErr && headObjectErr.code == "NotFound" ) {

                s3.putObject({
                    Bucket: EnvironmentConfig.getProperty('collector-v1','S3_MESSAGE_INSTANCE_BUCKET'),
                    Key: messageRequestGuid,
                    ACL: "bucket-owner-full-control",
                    Body: gzippedContent,
                    SSEKMSKeyId: EnvironmentConfig.getProperty('collector-v1','S3_SSE_KEY_ID'),
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
        //    }
            // We have received an error from the service, so let's bail this
            // DAO and return an error to the system.
        //    else {
        //        reject(new Error(headObjectErr ? "Unable to check for existing message in S3: " + headObjectErr.code : "S3 message with that key already exists."));
        //    }
        //});
    });
}

var encryptPatientReference = function(patientReference) {
    return new Promise(function(resolve, reject) {
        
        if( !patientReference ) {
            resolve(null);
            return;
        }
        
        var params = {
            KeyId: 'alias/flow/'+EnvironmentConfig.environment+'/accountReference', // we still use the accountReference key as that is the original name.
            Plaintext: patientReference.toString()
        };
        
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.encrypt(params, function(err, data) {
            if (err) 
                reject(err); // an error occurred
            else     
                resolve(data.CiphertextBlob.toString('base64'));
        });
    });
}

var decryptPatientReference = function(patientReferenceCipher) {
    return new Promise(function(resolve, reject) {
        
        if( !patientReferenceCipher ) {
            resolve(null);
            return;
        }
        
        var params = {
            CiphertextBlob: new Buffer(patientReferenceCipher, 'base64')
        };
        
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.decrypt(params, function(err, data) {
            if (err) 
                reject(err); // an error occurred
            else     
                resolve(data.Plaintext.toString());
        });
    });
}

var persistMessageRequest = function(messageRequest) {
    return new Promise(function(resolve,reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_INBOUND_MESSAGE_REQUESTS'),
            Item: messageRequest,
            ConditionExpression: "attribute_not_exists(messageRequestGuid)"
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(messageRequest);
        });
    });
}

var retrieveDdbMessage = function(messageRequestGuid) {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_INBOUND_MESSAGE_REQUESTS'),
            Key: {
                messageRequestGuid: messageRequestGuid   
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
                    reject(new Error('InboundMessageRequest not found for specified messageRequestGuid.'));
                else
                    resolve(data.Item);
            }
        });
    });
}

var retrieveMessage = function(messageRequestGuid) {
    var messageRequest;
    
    return retrieveDdbMessage(messageRequestGuid)
    .then(function(mr) {
        messageRequest = mr;
        return decryptPatientReference(messageRequest.patientReferenceCipher);
    })
    .then(function(decryptedPatientReference) {
        messageRequest.patientReference = decryptedPatientReference;
        return Promise.resolve(messageRequest);
    });
}

var retrieveMessageContentFromS3 = function(messageRequest) {
    return new Promise(function(resolve, reject) {        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        s3.getObject({
            Bucket: EnvironmentConfig.getProperty('collector-v1','S3_MESSAGE_INSTANCE_BUCKET'),
            Key: messageRequest.messageRequestGuid
        }, 
        function(err, data) {
            if(err) {
                console.error('Unable to retrieve message content from S3: ' + err);
                reject(err);
            }
            else {
                var body = data.Body.toString();
                /*
                switch(messageRequest.messageContentType.toLowerCase()) {
                    case "json": resolve(JSON.parse(pako.inflate(body,{to:'string'}))); return;
                    default: resolve(body); return;
                }
                */
                
                resolve(pako.inflate(body,{to:'string'}));
            }
        });
    });
}

module.exports = {  
  // Creates a new message object by creating a GUID for the message and then
  // storing the message request in S3.
  create: function( inboundMessageRequest ) {

    inboundMessageRequest.messageRequestGuid = uuid.v4();
    
    return saveContentToS3(inboundMessageRequest.messageRequestGuid, inboundMessageRequest.messageContent)
    .then( function() {
        return encryptPatientReference(inboundMessageRequest.patientReference);
    })
    .then( function(encryptedPatientReference) {
        
        var clonedMessageRequest = JSON.parse(JSON.stringify(inboundMessageRequest));
        delete clonedMessageRequest.patientReference;
        if(encryptedPatientReference) clonedMessageRequest.patientReferenceCipher = encryptedPatientReference;
        clonedMessageRequest.facilityStreamTypeLookup = [clonedMessageRequest.orgInternalName, clonedMessageRequest.facilityId, clonedMessageRequest.streamType].join('_');
        clonedMessageRequest.messageContent = null;
        clonedMessageRequest.created = new Date().getTime();
        
        return persistMessageRequest(clonedMessageRequest);
    });
  },
  
  getMessage: retrieveMessage,
  
  getMessageContent: retrieveMessageContentFromS3

};