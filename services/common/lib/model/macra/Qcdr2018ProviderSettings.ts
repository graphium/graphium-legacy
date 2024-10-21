export interface QcdrProviderByFacilitySetting {
    tin: string;
    providers: Array<{
        isReporting: boolean;
        providerNpi: string;
    }>;
}

// When the org is reporting and specifying TIN by provider
// we record the provider ID and the tin that will be selected.
export interface QcdrProviderByProviderSetting {
    facilityId:number;
    providers: Array<{
        providerId: number;
        isReporting: boolean;
        tin: string;
    }>;
}

export interface QcdrProviderSettings {
    tinByProviderSettings2017: QcdrProviderByProviderSetting[];
    tinByFacilitySettings2017: QcdrProviderByFacilitySetting[];
}

export default QcdrProviderSettings;