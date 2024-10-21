

var https = require('https');
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var _ = require('lodash');

var createDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1",
        maxRetries: 30
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var createDdbService = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1",
        maxRetries: 30
    });
    return ddbService;
}

var getTableDescription = function(table) {
    return new Promise(function(resolve, reject) {
        var ddbService = createDdbService();
        ddbService.describeTable({
            TableName: table
        }, function(err, data) {
            if( err ) {
                reject(err);
            }            
            else {
                resolve(data);
            }
        });
    });
}

var getConsistent = function(table, keyName, keyValue) {
    return new Promise(function(resolve,reject) {
        var keyParam = {};
        keyParam[keyName] = keyValue;

       var params = {
            TableName: table,
            Key: keyParam,
            ConsistentRead: true
        };

        var docClient = createDocClient();
        docClient.get(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                if(_.isEmpty(data) || _.isEmpty(data.Item))
                    reject(new Error('Item not found for specified key.'));
                else
                    resolve(data.Item);
            }
        });
    });
}

var scan = function(table, filterExpression, expressionAttributeValues, lastEvaluatedKey, otherParameters) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: table,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues
        };

        _.assign(params, otherParameters);

        if(lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        var docClient = createDocClient();
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}

var scanAll = function(table, filterExpression, expressionAttributeValues, otherParameters) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: table,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues
        };

        _.assign(params, otherParameters);
        
        var allItems = [];
        var getResults = function(lastEvaluatedKey) {
            if(lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            var docClient = createDocClient();
            docClient.scan(params, function(err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                allItems = allItems.concat(data.Items);
                if(data.LastEvaluatedKey) {
                    getResults(data.LastEvaluatedKey);
                }
                else {
                    resolve(allItems);
                }
            });
        }

        getResults();
    });
}

var queryAll = function(table, index, keyConditionExpression, expressionAttributeValues, scanForward, otherParameters) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: table,
            IndexName: index,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ScanIndexForward: scanForward === true
        };

        if(otherParameters) {
            _.assign(params, otherParameters);
        }

        var allItems = [];
        var getResults = function(lastEvaluatedKey) {
            if(lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            var docClient = createDocClient();
            docClient.query(params, function(err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                allItems = allItems.concat(data.Items);
                if(data.LastEvaluatedKey) {
                    getResults(data.LastEvaluatedKey);
                }
                else {
                    resolve(allItems);
                }
            });
        }

        getResults();
    });
}

var putUnique = function(table, data, uniquePropertyName) {
    return new Promise(function(resolve,reject) {
        var params = {
            TableName: table,
            Item: data,
            ConditionExpression: "attribute_not_exists("+uniquePropertyName+")"
        };
        
        var docClient = createDocClient();
        docClient.put(params, function(err, persistedItem) {
            if (err) reject(err);
            else resolve(persistedItem);
        });
    });
}

module.exports = {
    createDocClient: createDocClient,
    putUnique: putUnique,
    getConsistent: getConsistent,
    queryAll: queryAll,
    scan: scan,
    scanAll: scanAll,
    getTableDescription: getTableDescription,
    createDdbService: createDdbService
}