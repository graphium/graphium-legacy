import { Flow } from "../model/flow/Flow";
import { InboundMessageRequest } from "../model/flow/InboundMessageRequest";

import * as FlowDAO from "../dao/FlowDAO";
import * as MessageRequestDAO from "../dao/MessageRequestDAO";
import * as InboundMessageInstanceDAO from "../dao/InboundMessageInstanceDAO";
//import * as TransactionLog from '../log/TransactionLog';
var TransactionLog = require('../log/TransactionLog');

import * as _ from 'lodash';

function isValidFlowForMessageRequest(flow:Flow, messageRequest:InboundMessageRequest) {
    // Stream does not match stream/message type.
    if(flow.streamType != messageRequest.streamType) {
        console.error('Invalid message request, the specified flow stream type ('+flow.streamType+') does not match the message request streamType ('+messageRequest.streamType+').');
        return false;
    }

    if(!_.includes(flow.messageTypes, messageRequest.messageType.toString())) {
        console.error('Invalid message request, the message request message type ('+messageRequest.messageType+') is not support by the flows message types ('+flow.messageTypes.join(',')+').');
        return false;
    }

    // This flow script does not belong to this org.
    if(!flow.systemGlobal && messageRequest.orgInternalName != flow.orgInternalName) {
        return false;
    }

    return true;
}


export interface IntakeMessageRequestInput {
    orgInternalName: string;
    facilityId: number;
    streamType: 'gic'|'scheduled';
    messageType: string;
    messageContent: object;
    messageContentType: 'json';
    parentMessageRequestGuid?: string;
    childMessageRequestHandler?: string;
    parentMessageInstanceGuid?: string;
    parentFlowGuid?: string;
    specificFlowGuid?: string;
    staged?: boolean;
    patientReference?: string;
    syncStreamHashKey: string;
}
export async function intakeMessageRequest(input:IntakeMessageRequestInput) {

    var tl = new TransactionLog('INTAKE_MSG_RQST', {
        httpRequest: 'POST intakeMessageRequest',
        orgInternalName: input.orgInternalName,
        facilityId: input.facilityId,
        messageType: input.messageType,
        streamType: input.streamType
    });
                
    var organizationNameInternal = input.orgInternalName;
    var facilityId = input.facilityId;
    var messageInstanceGuids = [];
    var createdMessageInstances;

    let inboundMessageRequest:InboundMessageRequest = {
        orgInternalName: input.orgInternalName,
        facilityId: input.facilityId,
        streamType: input.streamType,
        messageType: input.messageType,
        order: 0,
        syncStreamHashKey: input.syncStreamHashKey,
        messageContent: input.messageContent,
        messageContentType: 'json',
        messageRequestGuid: null,
        parentMessageRequestGuid: input.parentMessageRequestGuid,
        parentFlowGuid: input.parentFlowGuid,
        specificFlowGuid: input.specificFlowGuid,
        staged: input.staged,
        patientReference: input.patientReference,
        created: new Date().getTime()
    };
    
    if(!inboundMessageRequest.syncStreamHashKey) {
        tl.logError('NO_STREAM_HASH_KEY', 'No syncStreamHashKey specified on message request.');
        throw new Error('No syncStreamHashKey specified on message request.');
    }
    
    if(!inboundMessageRequest.messageContentType) {
        tl.logError('NO_MSG_CNT_TYP', 'No messageContentType specified on message request.');
        throw new Error('No messageContentType specified on message request.');
    }
    
    // First persist the message content itself (ie. generate a valid
    // GUID and send the data to S3.)
    // @ts-ignore
    let persistedMessageRequest = await MessageRequestDAO.create(inboundMessageRequest);
    
    // Then retrieve the flows for the specified message types
    tl.appendLogData({ messageRequestGuid: persistedMessageRequest.messageRequestGuid });
    tl.logInfo('GET_FLOWS', 'Persisted message request, retrieving flows.');
    
    if( !persistedMessageRequest.staged ) {
        
        let matchedFlows = [];
        if(persistedMessageRequest.parentFlowGuid) {
            let flow = await FlowDAO.getFlow(persistedMessageRequest.parentFlowGuid)
            matchedFlows = [flow];
        }
        else if(persistedMessageRequest.specificFlowGuid) {
            let flow = await FlowDAO.getFlow(persistedMessageRequest.specificFlowGuid)
            if(isValidFlowForMessageRequest(flow, persistedMessageRequest)) {
                matchedFlows = [flow];
            }
            else {
                throw new Error('This specific flow is not executable by this message request.');
            }
        }
        else {            
            matchedFlows = await FlowDAO.getFlowsForMessage(
                organizationNameInternal, 
                facilityId, 
                inboundMessageRequest.streamType, 
                inboundMessageRequest.messageType.toString()
            );
        }

        // ... then create message instances for each of the flows
        // and store the initial state of the messages in DynamoDB. 
        // DynamoDB will create a trigger that will be caught by a Lambda
        // function and will be routed to either a Kinesis stream for sync
        // processing or SQS queue for async processing.
    
        if( !_.isArray(matchedFlows) || matchedFlows.length == 0 ) {
            tl.logWarn('NO_MTCH_FLOW', 'Unable to find flows that match message request.');
        }
        else {
            tl.appendLogData({matchedFlowGuids:_.map(matchedFlows, 'flowGuid')});
            tl.logInfo('MTCH_FLOW', 'Found matching flows, creating message instances.');
        }
    
        // We go ahead and send this even if matchedFlows is empty since it will handle an empty array of
        // flows and just return an empty array of message instances.
        let messageInstances = await InboundMessageInstanceDAO.createInstancesForFlows(
            input.orgInternalName, 
            input.facilityId, 
            persistedMessageRequest, 
            matchedFlows
        );  
        
        if( _.isArray(messageInstances) && messageInstances.length > 0 ) {   
            createdMessageInstances = messageInstances;
            
            for( var messageInstance of messageInstances ) {
                messageInstanceGuids.push(messageInstance.messageInstanceGuid);
            }
            
            tl.appendLogData({messageInstanceGuids:messageInstanceGuids});
            tl.logInfo('INSTS_CREATED','Created message instances, sending to router stream.');

            try {
                let kinesisPutResult = await InboundMessageInstanceDAO.addMessageInstancesToRouterStream(messageInstances);
                tl.logInfo('RTR_SUCCESS', 'Successfully send messages to router.', {kinesisPutResult:kinesisPutResult});
            }
            catch(error) {
                tl.logError('IDCT_RTE_FAIL', 'Indicating that message route failed.', { errorMessage: error.message, errorStack: error.stack });
                await InboundMessageInstanceDAO.indicateFailedRouting(messageInstanceGuids);
            }
        }
        else {
            tl.logInfo('SKIP_STREAM','No message instances created, not sending anything to stream.', {messageInstances:messageInstances});
        }
    }
    tl.finishTransaction();
}