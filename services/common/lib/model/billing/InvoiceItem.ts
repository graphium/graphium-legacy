import { SubscriptionProduct, DiscountType, QuantityMetric } from "./SubscriptionProduct";
import { Subscription } from "./Subscription";
import { Invoice } from "./Invoice";

export class InvoiceItem {
    subscription: Subscription;
    subscriptionId: string;
    subscriptionProductId: string;
    hasRateOverride: boolean;
    sku: string;
    productName: string;
    qbItemId: number;
    metric: QuantityMetric;
    description: string;
    actualRate: number;
    quantity: number;
    standardRate: number;
    discountType: DiscountType;
    discountAmount: number;
    totalDiscount: number;
    total: number;
    displayPriority:number;
    isUnpublishedProduct:boolean;
    productType:string;

    public clone():InvoiceItem {
        return <InvoiceItem>{
            subscription: this.subscription,
            subscriptionId: this.subscriptionId,
            subscriptionProductId: this.subscriptionProductId,
            hasRateOverride: this.hasRateOverride,
            sku: this.sku,
            productName: this.productName,
            qbItemId: this.qbItemId,
            metric: this.metric,
            description: this.description,
            actualRate: this.actualRate,
            quantity: this.quantity,
            standardRate: this.standardRate,
            discountType: this.discountType,
            discountAmount: this.discountAmount,
            totalDiscount: this.totalDiscount,
            total: this.total,
            displayPriority: this.displayPriority,
            isUnpublishedProduct: this.isUnpublishedProduct,
            productType: this.productType
        };
    }

    public toAirtable(airtableInvoiceId:string) {
        let discountTypeLabel:string = null;
        switch(this.discountType) {
            case DiscountType.Fixed: discountTypeLabel = "Fixed"; break;
            case DiscountType.Percentage: discountTypeLabel = "Percentage"; break;
        }

        return {
            "Invoice": [airtableInvoiceId],
            "Subscription": [this.subscriptionId],
            "Subscription Product": [this.subscriptionProductId],
            "Has Rate Override": this.hasRateOverride,
            "Description": this.description,
            "Actual Rate": this.actualRate,
            "Quantity": this.quantity,
            "Standard Rate": this.standardRate,
            "Discount Type": discountTypeLabel,
            "Discount Amount": this.discountAmount === undefined ? null : this.discountAmount,
            "Total Discount": this.totalDiscount,
            "Total": this.total,
            "Display Priority": this.displayPriority,
            "Is Unpublished Product": this.isUnpublishedProduct
        }
    }
}

