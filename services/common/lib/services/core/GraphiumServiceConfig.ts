
export interface GraphiumServiceConfig {
    orgInternalName: string;
    username: string;
    password: string;
    baseServiceUrl: string;
    rejectServiceError?: boolean;
    enableDiskCaching?: boolean;
}
