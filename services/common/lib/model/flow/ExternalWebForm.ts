interface ExternalWebForm {
    orgInternalName: string;
    facilityId:number | null;
    externalWebFormGuid:string;
    formTitle: string;
    formDescription: string;
    token:string;
    flowGuid: string;
    formDefinitionNames: string[];
    /**
     * This is the original ID that we would search for. We recently added an optional 
     * caseId search, which is an equivalent to 'encounter'. Instead of just searching for 
     * a single form, we search for a form that has both the case and record IDs. A single
     * case can contain multiple records (although the record ID must be unique between
     * each record.)
     * 
     * By default if associateCaseWithRecord is undefined  or false, we will default to only searching
     * by the recordId (which uses the ddb table searchKey)
     */
    associateCaseWithRecord?:boolean;
    caseIdParameterLabel?:string;
    caseIdParameterName?:string;
    caseIdParameterJsonPath?:string;
    recordIdParameterLabel?:string;
    recordIdParameterName?:string;
    recordIdParameterJsonPath?:string;
    /**
     * The prefix that will be attatched to the record ID that is pulled from the source data
     * via the recordIdParameterName or recordIdParameterJsonPath. Note that changing this
     * applies to new records created going forward and does not retroactively apply to records
     * that have already been created. If the same record ID is opened after this value changes
     * it will not find the old recordId that does not include the prefix and thus will attempt to 
     * create a new record. Be careful implementing this after a form has been released.
     */
    recordIdPrefix?:string;
    /**
     * Enables a debug window in the UI that logs output from the form. In the case of EWFs that 
     * allow submitting a flowsheet row to Epic this will log the output of the initial handshake
     * and other actions for easier debugging.
     */
    enableDebug?:boolean;
    serviceDateParameterJsonPath?:string;
    serviceDateSourceFormat?:string;
    facilityIdParameterName?:string;
    facilityIdMapping?: Map<string,number>;
    activeIndicator: boolean;
    createTime: Date|number;
    updateTime: Date|number;
    auditVersion: number;
    logoUrl?: string;
    submitEpicFlowsheetRowOnComplete?: boolean;
    completeEpicFlowsheetRowValues?: {
        rowId:string|number,
        rowName:string,
        rowValue:string|number
    }
}

export default ExternalWebForm;