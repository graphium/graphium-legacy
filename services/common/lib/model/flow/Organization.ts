interface Organization {
    organizationId: string;
    organizationName: string;
    organizationNameInternal: string;
    activeIndicator: boolean;
    createTime: Date;
    updateTime: string;
    auditVersion: number;
}

export default Organization;
