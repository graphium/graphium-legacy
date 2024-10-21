import { SalesPerson } from "./SalesPerson";
import { SubscriptionProduct } from "./SubscriptionProduct";
import { getItemFromTypes } from "../../util/AirtableUtil";
import { Invoice } from "./Invoice";

export class Commission {
    commissionId: string;
    invoice: Invoice;
    productName: string;
    salesPerson: SalesPerson;
    productTotal: number;
    commissionRate: number;
    commissionAmount: number;
    orgInternalName: string;
    organizationName: string;
    facilityName: string;
    facilityId: number;
    subscriptionProduct: SubscriptionProduct;

    public toAirtable():any {
        return {
            "Invoice": [this.invoice.invoiceId],
            "Product Name": this.productName,
            "Sales Person": [this.salesPerson.salesPersonId],
            "Product Total": this.productTotal,
            "Commission Rate": this.commissionRate,
            "Commission Amount": this.commissionAmount,
            "Org Internal Name": this.orgInternalName,
            "Organization Name": this.organizationName,
            "Facility Name": this.facilityName,
            "Facility ID": this.facilityId,
            "Subscription Product": [this.subscriptionProduct.subscriptionProductId]
        }
    }

    static fromAirtable(id:string, data: any, invoices:Invoice[], salesPeople:SalesPerson[], subscriptionProducts:SubscriptionProduct[]): Commission {
        let c = new Commission();
        c.commissionId = id;
        c.invoice = getItemFromTypes<Invoice>(invoices, 'invoiceId', data['Invoice'][0]);
        c.productName = data['Product Name'];
        c.salesPerson = getItemFromTypes<SalesPerson>(salesPeople, 'salesPersonId', data['Sales Person'][0]);
        c.subscriptionProduct = getItemFromTypes<SubscriptionProduct>(subscriptionProducts, 'subscriptionProductId', data['Subscription Product'][0]);
        c.productTotal = data['Product Total'];
        c.commissionRate = data['Commission Rate'];
        c.commissionAmount = data['Commission Amount'];
        c.orgInternalName = data['Org Internal Name'];
        c.organizationName = data['Organization Name'];
        c.facilityName = data['Facility Name'];
        c.facilityId = data['Facility ID'];
        return c;
    }
}