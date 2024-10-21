export interface FormPage {
    pageId: string;
    encounterFormId: string;
    pageName: string;
    pageNumber: number;
    createTime: Date | string;
    updateTime: Date | string;
    auditVersion: number;
}
