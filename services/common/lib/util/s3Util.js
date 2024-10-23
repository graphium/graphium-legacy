
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var _ = require('lodash');

var getObjectBody = function(bucket, key) {
    return new Promise(function(resolve, reject) {        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        s3.getObject({
            Bucket: bucket,
            Key: key
        }, 
        function(err, data) {
            if(err) {
                //console.error('Unable to retrieve data data from S3: ' + err);
                reject(err);
            }
            else {
                resolve(data.Body);
            }
        });
    });
}

var deleteObject = function(bucket, key) {
    return new Promise(function(resolve, reject) {        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        s3.deleteObject({
            Bucket: bucket,
            Key: key
        }, 
        function(err, data) {
            if(err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}

var putObject = function(bucket, key, data) {
    return new Promise(function(resolve, reject) {
        var dataString;
        if( _.isPlainObject(data) ) {
            dataString = JSON.stringify(data);
        }
        else if(_.isString(data)) {
            dataString = data;
        }
        else
            throw(new Error('Unable to save data to S3, not in appropriate format.'));
        
        var s3Params = {
            Bucket: bucket,
            Key: key,
            ACL: "bucket-owner-full-control",
            SSEKMSKeyId: EnvironmentConfig.getProperty('collector-v1','S3_SSE_KEY_ID'),
            ServerSideEncryption: "aws:kms",
            StorageClass: "STANDARD"
        };
        s3Params.Body = dataString;

        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        s3.putObject(s3Params, 
        function(err, persistedData) {
            if(err) {
                console.log(err.message);
                console.log(err.stack);
                reject(err);
            }
            else {
                resolve(persistedData);
            } 
        });
    });
}

var putObjectUnique = function(bucket, key, data) {
    return new Promise(function(resolve,reject) {
        
        if( !data ) {
            reject(new Error('Cannot persist data to S3, data empty.'));
            return;
        }
        
        var s3 = new AWS.S3( {signatureVersion:"v4"} );
        
        // First we determine if the object already exists. This is expensive to
        // do, I wish we had a better way, but for now we will see how it impacts
        // message throughput.
        s3.headObject({
            Bucket: bucket,
            Key: key
        },
        function(headObjectErr, headObjectData) {

            if( headObjectErr && headObjectErr.code == "NotFound" ) {

                s3.putObject({
                    Bucket: bucket,
                    Key: key,
                    ACL: "bucket-owner-full-control",
                    Body: data,
                    SSEKMSKeyId: EnvironmentConfig.getProperty('collector-v1','S3_SSE_KEY_ID'),
                    ServerSideEncryption: "aws:kms",
                    StorageClass: "STANDARD"
                }, 
                function(err, persistedData) {
                    if(err) {
                        reject(err);
                    }
                    else {
                        resolve(persistedData);
                    } 
                });
            }
            // We have received an error from the service, so let's bail this
            // DAO and return an error to the system.
            else {
                reject(new Error(headObjectErr ? "Unable to check for existing data in S3: " + headObjectErr.code : "S3 object with that key already exists."));
            }
        });
    });
}




module.exports = {
    putObject: putObject,
    deleteObject: deleteObject,
    getObjectBody: getObjectBody,
    putObjectUnique: putObjectUnique
}