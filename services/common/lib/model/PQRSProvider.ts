export interface PqrsProvider {
    facilityId:number,
    facilityName:string,
    facilityIsActive:boolean,
    providerId:number,
    providerNpi:string,
    providerLastName:string,
    providerFirstName:string,
    providerType:string,
    providerIsActive:boolean,
    providerHas2018Cases:boolean,
    provider2018CaseCount:number
}

export interface PqrsProvider2019 {
    facilityId:number,
    facilityName:string,
    facilityIsActive:boolean,
    providerId:number,
    providerNpi:string,
    providerLastName:string,
    providerFirstName:string,
    providerType:string,
    providerIsActive:boolean,
    providerHas2019Cases:boolean,
    provider2019CaseCount:number
}