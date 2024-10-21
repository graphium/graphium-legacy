export interface Facility {
    activeIndicator:boolean;
    addressCityName:string;
    addressLine1:string;
    addressLine2:string;
    addressStateCode:string;
    addressZipCode:number;
    auditVersion:number;
    createTime:Date;
    facilityDescription:string;
    facilityId:number;
    facilityName:string;
    facilityNameInternal:string;
    organizationId:string;
    phoneNumberMain:number;
    subscriptionData:{
        orderDate: string;
        goLiveDate: string;
        primaryUse: string;
        facilityType: string;
        offboardDate: string;
        facilityStatus: string;
        offboardReason: string;
        isReportingMacra: boolean;
        macraFormDataEntry: boolean;
        otherOffboardReason: string;
        offboardToFacilityId: number;
        primaryCaseCaptureMode: string;
        offboardToOrgInternalName: string;
        macraFormDataEntryServicer: string;
    };
    testFacilityIndicator:boolean;
    updateTime:string;
}

export default Facility;