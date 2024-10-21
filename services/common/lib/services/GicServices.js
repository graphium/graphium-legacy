/* 
These are simple wrappers around the REST APIs that are exposed through the 
beanstalk instances, etc. Makes it easier for Lambda, et.al. to access these APIs.
The code for the actual APIs are exposed in their specific repository, ie. flow-core-services-private
*/
var request = require('request-promise');
var _ = require('lodash');

function getBaseUrl()
{
    if( !process.env.FLOW_GIC_SERVICES_URI )
        throw new Error('Unable to create wrapper for gic-services, uri env vars not defined.');
    return process.env.FLOW_GIC_SERVICES_URI;
}

module.exports = {
    toEhr: function(apiKey, systemId) {
        var options = {
            method: 'GET',
            uri: getBaseUrl() + '/q/hl7/ToEHR/'+apiKey+'/'+systemId,
            json: true
        };
        
        return request(options);
    },
    
    toEhrAck: function(apiKey, systemId, messageId, result, error) {
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/ToEHRAck/' + apiKey + '/' + systemId + '/' + messageId,
            json: true,
            body: {
                result: result,
                error: error
            }
        };
        
        return request(options);
    },
    
    fromEhr: function(apiKey, systemId, message, returnRequest) {
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/q/hl7/FromEHR/'+apiKey+'/'+systemId,
            body: message,
            qs: {
                returnRequest: returnRequest  
            },
            json: true
        };
        
        return request(options);
    },
    
    fromEhrStage: function(apiKey, systemId, message, returnRequest) {
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/FromEHR/stage/'+apiKey+'/'+systemId,
            body: message,
            qs: {
                returnRequest: returnRequest  
            },
            json: true
        };
        
        return request(options);
    },
    
    createLogEntry: function(logEntry) {
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/log',
            body: logEntry,
            json: true
        };
        
        return request(options);
    },

    intakeMessageRequest: function(orgInternalName, facilityId, inboundMessageRequest, returnRequest) {
        returnRequest = _.isBoolean(returnRequest) ? returnRequest : false;
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/org/' + orgInternalName + '/facility/' + facilityId + '/messageRequest?returnRequest=' + returnRequest,
            body: inboundMessageRequest,
            json: true
        };
        
        return request(options);
    }
}