export interface InboundMessageRequest {
    orgInternalName: string;
    facilityId: number;
    facilityStreamTypeLookup?: string;
    streamType: 'gic'|'scheduled';
    messageType: string;
    order: number;
    syncStreamHashKey: string;
    messageContent: string|object;
    messageContentType: 'json';
    messageRequestGuid: string;
    parentMessageRequestGuid?: string;
    parentFlowGuid?: string;
    specificFlowGuid?: string;
    staged?: boolean;
    patientReferenceCipher?: string;
    patientReference?: string;
    created: number;
}

export default InboundMessageRequest;