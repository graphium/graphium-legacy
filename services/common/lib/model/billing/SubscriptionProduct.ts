import { Subscription } from "./Subscription";
import { ProductType } from "./ProductType";
import { getItemFromTypes, getItemsFromTypes } from '../../util/AirtableUtil';
import * as _ from 'lodash';
import { CommissionRate } from "./CommissionRate";

export enum QuantityMetric {
    ReportingProvider = 'REPORTING_PROVIDER',
    DataEntryPerformed = 'DATA_ENTRY_PERFORMED',
    ImportBatchRecordsCreated = 'IMPORT_BATCH_RECORDS_CREATED',
    CasesCreated = 'CASES_CREATED',
    CasesPerformed = 'CASES_PERFORMED',
    Facility = 'FACILITY'
}

export enum DiscountType {
    Fixed = "FIXED",
    Percentage = "PERCENTAGE"
}

export class SubscriptionProduct {
    subscriptionProductId: string;
    productType: ProductType;
    metricOverride: QuantityMetric;
    discountType: DiscountType;
    discountAmount: number | null;
    rateOverride: number;
    additionalDescriptionText: string;
    subscriptionId: string;
    setupDate: string;
    endDate: string;
    commissionRates: CommissionRate[];
    fixedQuantity: number;

    calculateActualRate():number {
        if(this.rateOverride) {
            return this.rateOverride;
        }
        else if(this.discountAmount && this.discountType) {
            switch(this.discountType) {
                case DiscountType.Fixed:
                    return _.round(this.productType.rate - this.discountAmount, 2);
                case DiscountType.Percentage:
                    return _.round(this.productType.rate - (this.productType.rate*this.discountAmount), 2);
                default:
                    throw new Error('Unable to calculate discount amount, unkonwn discount type: ' + this.discountType);
            }
        }
        else {
            return this.productType.rate;
        }
    }

    static fromAirtable(id:string, data: any, commissionRates?:CommissionRate[], productTypes?:ProductType[]): SubscriptionProduct {
        let sp = new SubscriptionProduct();
        sp.subscriptionProductId = id;
        sp.productType = getItemFromTypes<ProductType>( productTypes, 'productTypeId', data['Product'][0] );
        sp.commissionRates = getItemsFromTypes<CommissionRate>( commissionRates, 'commissionRateId', data['Commission Rates']);
        sp.metricOverride = (_.toUpper(_.snakeCase(data['Metric Override'])) || null) as QuantityMetric;
        sp.discountType = (_.toUpper(_.snakeCase(data['Discount Type'])) || null) as DiscountType;
        sp.discountAmount = data['Discount Amount'];
        sp.rateOverride = data['Rate Override'];
        sp.additionalDescriptionText = data['Additional Description Text'];
        sp.subscriptionId = data['Subscription'] ? data['Subscription'][0] : null;
        sp.setupDate = data['Setup Date'] ? data['Setup Date'] : null;
        sp.endDate = data['End Date'] ? data['End Date'] : null;
        sp.fixedQuantity = data['Fixed Quantity'];
        return sp;
    }
}