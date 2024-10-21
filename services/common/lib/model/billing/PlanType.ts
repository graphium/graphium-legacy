export class PlanType {
    planTypeId: string;
    planTypeCode: string;
    published:string;
    unpublished: string;
    planTitle: string;
    chargifyCode:string;

    static fromAirtable(id:string, data: any): PlanType {
        let pt = new PlanType();
        pt.planTypeId = id;
        pt.planTypeCode = data['Code'];
        pt.published = data['Published'];
        pt.unpublished = data['Unpublished'];
        pt.planTitle = data['Plan Name'];
        pt.chargifyCode = data['Chargify Code'];
        return pt;
    }
}