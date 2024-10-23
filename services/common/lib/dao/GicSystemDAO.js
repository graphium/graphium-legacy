var Promise = require('bluebird');
var AWS = require('aws-sdk');
var uuid = require('uuid');
var _ = require('lodash');
var https = require('https');
var ddb =  require('../util/ddbUtil');
const ddbUtil = require('../util/ddbUtil');

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var getAllGicSystems = function() {
    return ddbUtil.scanAll(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_GIC_SYSTEMS'));
}

var createGicSystem = function(system) {
    return new Promise(function(resolve,reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_GIC_SYSTEMS'),
            Item: system,
            ConditionExpression: "attribute_not_exists(systemId)"
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(system);
        });
    });
}

var updateGicSystem = function(system) {
    return new Promise(function(resolve,reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_GIC_SYSTEMS'),
            Item: system,
            ConditionExpression: "attribute_exists(systemId)"
        };
        
        var docClient = createDynamoDbDocClient();
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(system);
        });
    });
}

var getGicSystem = function(systemId) {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_GIC_SYSTEMS'),
            Key: {
                systemId: systemId   
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
                    reject(new Error('GicSystem not found for specified systemId.'));
                else
                    resolve(data.Item);
            }
                
        });
    });
}

var getGicSystemByInternalName = function(systemInternalName) {
    return new Promise(function(resolve,reject) {
       var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_GIC_SYSTEMS'),
            FilterExpression : 'systemInternalName = :systemInternalName',
            ExpressionAttributeValues : {':systemInternalName' : systemInternalName}
        };

        var docClient = createDynamoDbDocClient();
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                if(_.isEmpty(data) || _.isEmpty(data.Items))
                    reject(new Error('GicSystem not found for specified systemInternalName.'));
                else if( data.Items.length > 1 )
                    reject(new Error('Found more than one system with that name.'));
                else
                    resolve(data.Items[0]);
            }
                
        });
    });
}

module.exports = {
    
    getSystemByInternalName: getGicSystemByInternalName,
    
    getSystem: function(systemId) {
        if( !_.isString(systemId) || _.isEmpty(systemId))
            throw new Error('System ID is not defined, unable to retrieve system object.');
            
        return getGicSystem(systemId);
    },
    
    updateSystem: function(system) {
        if( !_.isPlainObject(system) || _.isEmpty(system.systemId) )
            throw new Error('Unable to update system, system is in valid format.');
            
        return updateGicSystem(system);  
    },
    
    createSystem: function(systemId, orgInternalName, facilityId, facilityIdPointer ) {
        if( !_.isString(systemId) || !_.isString(orgInternalName) || (!_.isNumber(facilityId) && !_.isString(facilityIdPointer)) )
            throw new Error('Unable to create new GicSystem instance, missing properties.');

        var gicSystem = {
            systemId: systemId,
            orgInternalName: orgInternalName,
            facilityId: facilityId,
            facilityIdPointer: facilityIdPointer  
        };
        
        // Persist the message to DynamoDB
        return createGicSystem(gicSystem);
    },

    getAllGicSystems: getAllGicSystems
}