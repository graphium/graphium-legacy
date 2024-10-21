import * as _ from 'lodash';
import { QuantityMetric } from './SubscriptionProduct';

export enum BillingType {
    PercentOfCollections = 'PERCENT_OF_COLLECTIONS',
    MeteredAnnual = 'METERED_ANNUAL',
    MeteredMonthly = 'METERED_MONTHLY',
    FixedMonthly = 'FIXED_MONTHLY',
    FixedAnnual = 'FIXED_ANNUAL',
    FixedOneTime = 'FIXED_ONE_TIME',
    SeatLicense = 'SEAT_LICENSE',
    BaseFeePlusOverage = 'BASE_FEE_PLUS_OVERAGE'
}

export enum BillingUnit {
    Provider = 'PROVIDER',
    Case = 'CASE',
    Form = 'FORM',
    Channel = 'CHANNEL',
    Collections = 'COLLECTIONS',
    Facility = 'FACILITY',
    FaxLine = 'FAX_LINE',
    FtpFolder = 'FTP_FOLDER'
}

export enum ProductTypeType {
    Subscription = 'SUBSCRIPTION',
    AddOn = 'ADD_ON',
    Integration = 'INTEGRATION',
    SetupInstallation = 'SETUP_INSTALLATION'
}

export class ProductType {
    productTypeId: string;
    productTitle: string;
    sku: string;
    billingType: BillingType;
    billingUnit: BillingUnit;
    chargifyCode: string;
    chargifyPricePointCode: string;
    defaultPricePoint: boolean;
    rate: number;
    meteredQuantityMetric: QuantityMetric;
    published: string;
    unpublished: string;
    displayPriority: number;
    description: string;
    productType: ProductTypeType;
    includedUnits: number;
    hideIfEmpty: boolean;
    subscriptionCount: number;
    chargebeePlanName: string;
    qbIncomeAccount: string;
    requiredAddonId: string;
    taxJarCode: string;

    public getBillingUnitLable() {
        switch(this.billingUnit) {
            case BillingUnit.Case: return "Case";
            case BillingUnit.Channel: return "Channel";
            case BillingUnit.Collections: return "Collection";
            case BillingUnit.Facility: return "Facility";
            case BillingUnit.FaxLine: return "Fax Line";
            case BillingUnit.Form: return "Form";
            case BillingUnit.FtpFolder: return "FTP Folder";
            case BillingUnit.Provider: return "Provider";
        }
        return "Unit";
    }

    public getBillingUnitPluralLable() {
        switch(this.billingUnit) {
            case BillingUnit.Case: return "Cases";
            case BillingUnit.Channel: return "Channels";
            case BillingUnit.Collections: return "Collection";
            case BillingUnit.Facility: return "Facilities";
            case BillingUnit.FaxLine: return "Fax Lines";
            case BillingUnit.Form: return "Forms";
            case BillingUnit.FtpFolder: return "FTP Folders";
            case BillingUnit.Provider: return "Providers";
        }
        return "Units";
    }

    static getQuantityMetricLabel(metric:QuantityMetric) {
        switch(metric) {
            case QuantityMetric.CasesCreated: return "Case";
            case QuantityMetric.CasesPerformed: return "Case";
            case QuantityMetric.DataEntryPerformed: return "Record";
            case QuantityMetric.ImportBatchRecordsCreated: return "Record";
            case QuantityMetric.ReportingProvider: return "Provider";
            case QuantityMetric.Facility: return 'Facility';
        }
        return "Units Processed";
    }

    static getQuantityActionLabel(metric:QuantityMetric) {
        switch(metric) {
            case QuantityMetric.CasesCreated: return "Cases Created";
            case QuantityMetric.CasesPerformed: return "Cases Performed";
            case QuantityMetric.DataEntryPerformed: return "Records Transcribed";
            case QuantityMetric.ImportBatchRecordsCreated: return "Records Imported";
            case QuantityMetric.ReportingProvider: return "Providers Reporting";
            case QuantityMetric.Facility: return 'Facilities';
        }
        return "Units Processed";
    }

    static fromAirtable(id:string, data: any): ProductType {
        let pt = new ProductType();
        pt.productTypeId = id;
        pt.productTitle = data['Title'];
        pt.sku = data['SKU'];
        pt.billingType = _.toUpper(_.snakeCase(data['Billing Type'])) as BillingType;
        pt.billingUnit = _.toUpper(_.snakeCase(data['Unit Name'])) as BillingUnit;
        pt.chargifyCode = data['Chargify Code'];
        pt.chargifyPricePointCode = data['Chargify Price Point Code'];
        pt.defaultPricePoint = data['Default Price Point'];
        pt.productType = _.toUpper(_.snakeCase(data['Product Type'])) as ProductTypeType;
        pt.rate = parseFloat(data['Rate']);
        pt.meteredQuantityMetric = _.toUpper(_.snakeCase(data['Metered Quantity Metric'])) as QuantityMetric;
        pt.published = data['Published'];
        pt.unpublished = data['Unpublished'];
        pt.displayPriority = data['Display Priority'];
        pt.description = data['Description'];
        pt.includedUnits = data['Included Units'];
        pt.hideIfEmpty = data['Hide if Empty'];
        pt.subscriptionCount = data['Subscription Count'];
        pt.chargebeePlanName = data['Chargebee Plan Name'];
        pt.qbIncomeAccount = data['QB Income Account'];
        pt.requiredAddonId = data['Required Add-On'];
        pt.taxJarCode = data['Tax Jar Code'];
        return pt;
    }
}
