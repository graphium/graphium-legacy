export type TinMode2017 = "byProvider" | "byFacility";

export interface Qcdr2017GeneralSettings {
    tinMode2017:TinMode2017
}

export interface QcdrGeneralSettings {
    state?:MacraState,
    tinSettings?:{[name: string]: TinSettings},
    reportingSettings?:{[name: string]: ReportingSettings},
    activitySettings?:{[name:string]:ActivitySettings}
}

export interface MacraState {
    tinSettingsSaved:boolean,
    reportingSettingsSaved:boolean,
    activitySettingsSaved:boolean
}

export interface TinSettings {
    submitForFacility:boolean,
    groupTin:number,
    applyTinToAll:boolean,
    providers:ProviderTin[]
}

export interface ReportingSettings {
    reportingType:string,
    providers:ProviderReportingStatus[]
}

export interface ActivitySettings {
    activity1?:boolean,
    activity2?:boolean,
    activity3?:boolean,
    activity4?:boolean,
    activity5?:boolean
}

export interface ProviderTin {
    npi:number,
    tin:number
}

export interface ProviderReportingStatus{
    npi:number,
    enableReporting:boolean
}

export default QcdrGeneralSettings;