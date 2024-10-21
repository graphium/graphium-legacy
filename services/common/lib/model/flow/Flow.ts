export interface Flow {
    flowGuid:string;
    flowName:string;
    flowDescription?:string;
    orgInternalName:string;
    facilityId:number|null;
    streamType:string;
    messageTypes:string[];
    processingOrderType: 'sync';
    flowType:'script'|'system';
    scriptLanguage?: 'javascript'|'typescript';
    runtimeVersion?: '1.0.0'|'1.1.0';
    defaultHandler?:string;
    flowContent:string;
    timeout:number;
    createdAt?:number;
    lastUpdatedAt?:number;
    flowConfig?:any;
    flowConfigCipher?:string;
    version?: number;
    active:boolean;
    systemGlobal:boolean|null;

    systemFlowScript?:string;
    systemFlowScriptContent?:any;
}

export default Flow;