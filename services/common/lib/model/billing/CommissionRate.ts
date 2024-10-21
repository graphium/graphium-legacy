import { SalesPerson } from "./SalesPerson";
import { SubscriptionProduct } from "./SubscriptionProduct";
import { getItemFromTypes } from "../../util/AirtableUtil";

export class CommissionRate {
    commissionRateId: string;
    salesPerson: SalesPerson;
    commissionRate:number;
    subscriptionProduct: SubscriptionProduct;

    static fromAirtable(id:string, data: any, salesPeople:SalesPerson[], subscriptionProducts:SubscriptionProduct[]): CommissionRate {
        let c = new CommissionRate();
        c.commissionRateId = id;
        c.salesPerson = getItemFromTypes<SalesPerson>(salesPeople, 'salesPersonId', data['Sales Person'][0]);
        c.commissionRate = data['Commission Rate'];
        c.subscriptionProduct = data['Subscription Product'];
        return c;
    }
}