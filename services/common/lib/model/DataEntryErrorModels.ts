export interface DataEntryErrorResult {
    facilityId?:number,
    providerId?:string,
    fieldKey?:string,
    errorTypeKey?:string,
    label:string,
    value:string,
}

export interface RecordQueryParams {
    facilityId?: number;
    fieldKey?: string;
    errorTypeKey?: string;
    providerId?: number;
    size: number; 
}