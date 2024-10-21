

import * as https from 'https';
import * as AWS from 'aws-sdk';
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import { QueryInput } from 'aws-sdk/clients/dynamodb';

export function createDocClient() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

export async function getConsistent<T>(table:string, keyName:keyof T, keyValue:any) {
    var keyParam:any = {};
    keyParam[keyName] = keyValue;
    
    var params = {
        TableName: table,
        Key: keyParam,
        ConsistentRead: true
    };
    
    let result = await createDocClient().get(params).promise();
    return (_.isEmpty(result) || _.isEmpty(result.Item)) ? null : result.Item as T;
}

/*
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
*/

async function queryPage<T>(params:AWS.DynamoDB.DocumentClient.QueryInput, lastEvaluatedKey?:AWS.DynamoDB.DocumentClient.Key, items?:T[]) {
    if(lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
    }

    if(!items) {
        items = new Array<T>();
    }

    let result = await createDocClient().query(params).promise();
    items = items.concat(result.Items as T[]);
    
    if(result.LastEvaluatedKey) {
        await queryPage<T>(params, result.LastEvaluatedKey, items);
    }

    return items;
}


export async function queryAll<T>(parameters:QueryInput):Promise<T[]>;
export async function queryAll<T>(table:string, index:string, keyConditionExpression:string,expressionAttributeValues:AWS.DynamoDB.DocumentClient.ExpressionAttributeValueMap, scanForward?:boolean):Promise<T[]>;
export async function queryAll<T>(tableOrParameters:QueryInput|string, 
        index?:string, 
        keyConditionExpression?:string, 
        expressionAttributeValues?:AWS.DynamoDB.DocumentClient.ExpressionAttributeValueMap, 
        scanForward?: boolean,
        projectionExpression?: string):Promise<T[]> {

    let queryInput:QueryInput = tableOrParameters as QueryInput;        
    if(typeof tableOrParameters === "string") {
        queryInput = <QueryInput>{
            TableName: tableOrParameters,
            IndexName: index,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ScanIndexForward: scanForward === true
        };
    }

    let allItems = await queryPage<T>(queryInput);
    return allItems;
}

export async function putUnique(table:string, data:any, uniquePropertyName:string) {
    console.log('putUnique: ' + table);
    await createDocClient().put({
        TableName: table,
        Item: data,
        ConditionExpression: "attribute_not_exists("+uniquePropertyName+")"
    }).promise();
}