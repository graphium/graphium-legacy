export interface Provider {
    providerId: string,
    facilityId: number,
    providerType: string,
    firstName: string,
    lastName: string,
    nationalProviderId: string,
    localProviderId: string,
    speciality: string,
    groupName: string,
    activeIndicator: boolean,
    createTime: string,
    updateTime: string,
    auditVersion: number
}

export default Provider;