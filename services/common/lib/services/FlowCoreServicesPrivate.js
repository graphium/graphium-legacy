/* 
These are simple wrappers around the REST APIs that are exposed through the 
beanstalk instances, etc. Makes it easier for Lambda, et.al. to access these APIs.
The code for the actual APIs are exposed in their specific repository, ie. flow-core-services-private
*/
var request = require('request-promise');
var _ = require('lodash');
var signature = require('../util/signature.js');
var TransactionLog = require('../log/TransactionLog');
var FlowDAO = require('../dao/FlowDAO');
var MessageRequestDAO = require('../dao/MessageRequestDAO');

function getBaseUrl()
{
    if( !EnvironmentConfig.getProperty('gic-services-v1','FLOW_CORE_SERVICES_PRIVATE_URI'))
        throw new Error('Unable to create wrapper for flow-core-services-private, uri env vars not defined.');
    return EnvironmentConfig.getProperty('gic-services-v1','FLOW_CORE_SERVICES_PRIVATE_URI');
}

function processMessageInstance(messageInstance, returnResult) {
    var flow;
    
    var tl = new TransactionLog('PRCESS_MSG_INST', {
        httpRequest: 'POST processMessageInstance',
        messageInstanceGuid: messageInstance.messageInstanceGuid,
        flowGuid: messageInstance.flowGuid
    });
        
    // Retrieve flow from ddb.
    return FlowDAO.getFlow(messageInstance.flowGuid)
    .then(function(flowResult) {
        flow = flowResult;
        return MessageRequestDAO.getMessageContent(messageInstance.messageRequest)    
    })
    .then( function(messageContent) {
        if(messageInstance.messageRequest.messageContentType == 'json') {
            try {
                messageInstance.messageRequest.messageContent = JSON.parse(messageContent);
            }
            catch(err) {
                tl.logError('MSG_PARSE_ERR','Error parsing message content as json.');
                throw( new Error('Unable to parse messageContent as json. Please ensure the message content is serialized correctly.'));
            }
        }
        else {
            
            // If the type isn't specified, we just try and parse it, otherwise we send it in whatever
            // format we have it.
            try { 
                messageInstance.messageRequest.messageContent = JSON.parse(messageContent);
            }
            catch(err) {
                messageInstance.messageRequest.messageContent = messageContent;
            }
        }
        tl.sample('getMessageContent');
        tl.logInfo('RUN_SCRPT','Executing flow script.');
        return new FlowScript(flow, messageInstance, tl.transactionId).run();
    })
    .then( function(flowScriptResult) {
        tl.sample('runScript');
        tl.logInfo('SCRPT_SUCCESS', 'FlowScript executed successfully.', {
            flowScriptResult: flowScriptResult,
            messageInstanceLifetime: Date.now() - messageInstance.messageInstanceCreated
        });
        tl.finishTransaction();
        
        return Promise.resolve(returnResult === true ? flowScriptResult : null);
    })
    .catch( function(error) {
        tl.logError('ERROR','Unable to process message instance.', error);
        tl.finishTransaction();
        
        throw error;
    });
}

module.exports = {
    
     sendOutboundGicRequest: function(orgInternalName, systemName, outboundMessageRequest, returnResult) {
        
        var sig = signature.generate(outboundMessageRequest,EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/org/'+orgInternalName+'/gic/system/name/'+systemName+'/outbound/messageRequest',
            body: outboundMessageRequest,
            json: true,
            qs: {
                signature: sig
            } 
        };
        
        if(returnResult)
            options.qs.returnResult = true;
        
        return request(options);
    },
    
    processMessageInstance: function(messageInstanceId, messageInstance, returnResult, transactionId) {
        
        return processMessageInstance(messageInstance, returnResult);

        /*
        var sig = signature.generate(messageInstance,EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/message/instance/' + messageInstanceId + '/process',
            body: messageInstance,
            json: true,
            qs: {
                signature: sig
            } 
        };

        if(transactionId)
            options.qs.tid = transactionId;
        
        if(returnResult)
            options.qs.returnResult = true;
        
        return request(options);
        */
    },

    ///collector/batch/:importBatchGuid/:recordIndex/process/:flowGuid
    processImportBatchRecord: function(importBatchGuid, recordIndex, flowGuid) {
        var sig = signature.generate({importBatchGuid:importBatchGuid,recordIndex:recordIndex},EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/collector/batch/' + importBatchGuid + '/' + recordIndex + '/process/' + flowGuid,
            json: true,
            qs: {
                signature: sig
            } 
        };

        return request(options);
    },
    // collector/batch/:importBatchGuid/records/generate
    generateBatchRecords: function(importBatchGuid) {
        var sig = signature.generate({importBatchGuid:importBatchGuid},EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/collector/batch/' + importBatchGuid + '/records/generate',
            json: true,
            qs: {
                signature: sig
            } 
        };

        return request(options);
    },
    
    reprocessBatchRecords: function(importBatchGuid, userName, orgUserId, indexUserId) {
        var user = {
            userName: userName,
            orgUserId: orgUserId,
            indexUserId: indexUserId
        }

        var sig = signature.generate({importBatchGuid:importBatchGuid, user:user},EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/collector/batch/' + importBatchGuid + '/records/reprocess',
            json: true,
            body: user,
            qs: {
                signature: sig
            } 
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
        
        var sig = signature.generate({hash:inboundMessageRequest.syncStreamHashKey},EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        returnRequest = _.isBoolean(returnRequest) ? returnRequest : false;
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/org/' + orgInternalName + '/facility/' + facilityId + '/inbound/messageRequest',
            body: inboundMessageRequest,
            json: true,
            qs: {
                signature: sig,
                returnRequest: returnRequest
            } 
        };
        return request(options);
    },

    createFtpConnectionFile: function(ftpSiteGuid, fileConnectionInfo) {
        
        var sig = signature.generate(fileConnectionInfo,EnvironmentConfig.getProperty('flow-core-services','CORE_SVC_API_KEY'));
        var options = {
            method: 'POST',
            uri: getBaseUrl() + '/collector/ftp/connection/' + ftpSiteGuid + '/file',
            body: fileConnectionInfo,
            json: true,
            qs: {
                signature: sig
            },
            timeout: 300000
        };
        console.log('Creating request: ' + JSON.stringify(options));
        return request(options);
    }
}