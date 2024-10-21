import { InvoiceItem } from './InvoiceItem';
import { GetSystemUsageByOrgResults } from '../../dao/SystemUsageDAO';
import { Subscription } from './Subscription';
import { BillingType, ProductType, ProductTypeType } from './ProductType';
import { QuantityMetric, DiscountType, SubscriptionProduct } from './SubscriptionProduct';
import Organization from '../flow/Organization';
import Facility from '../flow/Facility';

import * as _ from 'lodash';
import { QbInvoice } from '../quickbooks/QbInvoice';
import { getItemsFromTypes } from '../../util/AirtableUtil';
import { Commission } from './Commission';
import * as moment from 'moment';

export class Invoice {

    public invoiceId: string;
    public items: InvoiceItem[];
    public total: number;
    public qbInvoiceId: string;
    public qbInvoiceNumber: string;
    public subscriptions:Subscription[];
    public subscriptionMonth: string;
    public invoiceDate: string;
    public commissions: Commission[];
    
    // not persisted in airtable yet:
    public qbCustomerId: number;
    public organization: Organization;
    public facilities: Facility[];
    public orgUsageMetrics: GetSystemUsageByOrgResults[];

    static fromAirtable(id:string, data: any, subscriptions:Subscription[]): Invoice {
        let i = new Invoice();
        i.invoiceId = id;
        i.items = [];
        i.total = data['Total'];
        i.qbInvoiceId = data['QB Invoice ID'];
        i.qbInvoiceNumber = data['QB Invoice Number'];
        i.subscriptions = getItemsFromTypes<Subscription>(subscriptions, 'subscriptionId', data['Subscriptions']);
        return i;
    }

    public toAirtable(qbInvoice:QbInvoice):any {

        if(!this.organization || !this.qbCustomerId || !this.facilities || !this.orgUsageMetrics) {
            throw new Error('Unable to generate airtable object for invoice, invoice missing required data.');
        }

        let name = this.organization.organizationName;
        if(this.facilities.length == 1) {
            name += " - " + this.facilities[0].facilityName;
        }
        name += ' - ' + this.subscriptionMonth;
        return {
            "Name": name,
            "Subscription Month": this.subscriptionMonth,
            "Subscriptions": this.subscriptions.map((s) => s.subscriptionId),
            "Total": qbInvoice.TotalAmt,
            "QB Invoice ID": qbInvoice.Id,
            "QB Invoice Number": qbInvoice.DocNumber,
            "Invoice Date": qbInvoice.TxnDate
        }
    }

    private formatCurrency(n: number): string {
        return '$' + _.round(n, 2).toFixed(2);
    }

    private formatThousands(n:number, decimalPlaces:number): string {
        var s = '' + (Math.floor(n));
        let d = n % 1;
        let i = s.length;
        let r = '';

        // tslint:disable-next-line:no-conditional-assignment
        while ( (i -= 3) > 0 ) { 
            r = ',' + s.substr(i, 3) + r;
        }
        return s.substr(0, i + 3) + r + 
            (d ? '.' + Math.round(d * Math.pow(10, decimalPlaces || 2)) : '');
    }

    public generateInvoiceItems(
        qbCustomerId: number,
        subscriptions: Subscription[],
        subscriptionMonth: string,
        organization: Organization,
        facilities: Facility[],
        orgUsageMetrics: GetSystemUsageByOrgResults[]): void {

        this.qbCustomerId = qbCustomerId;
        this.subscriptions = subscriptions;
        this.subscriptionMonth = subscriptionMonth;
        this.organization = organization;
        this.facilities = facilities;
        this.orgUsageMetrics = orgUsageMetrics;
        this.commissions = [];

        let activeFacilities = facilities.filter((f) => f.activeIndicator == true && f.testFacilityIndicator == false);

        this.items = [];
        for (let subscription of subscriptions) {

            let isOrgLevelSubscription = subscription.facilityId == null || !_.isNumber(subscription.facilityId);
            let systemUsage:GetSystemUsageByOrgResults;
            console.log(JSON.stringify(orgUsageMetrics,null,4));
            if(isOrgLevelSubscription) {

                systemUsage = {
                    orgInternalName: subscription.orgInternalName,
                    facilityId: -1,
                    facilityActiveIndicator: null,
                    casesCreated: 0,
                    casesPerformed: 0,
                    dataEntryPerformed: 0,
                    recordsImported: 0
                }

                for(let activeFacility of activeFacilities) {
                    let facilityUsage = orgUsageMetrics.find(
                        (su) =>
                            su.facilityId == activeFacility.facilityId &&
                            su.orgInternalName == subscription.orgInternalName
                    );
                    if(!facilityUsage) {
                        throw new Error(
                            'Unable to locate system usage for facility: ' +
                                subscription.orgInternalName +
                                ':' +
                                subscription.facilityId
                        );
                    }

                    systemUsage.casesCreated += facilityUsage.casesCreated;
                    systemUsage.casesPerformed += facilityUsage.casesPerformed;
                    systemUsage.dataEntryPerformed += facilityUsage.dataEntryPerformed;
                    systemUsage.recordsImported += facilityUsage.recordsImported;
                    systemUsage.facilityActiveIndicator = true;
                }
            }
            else {
                let facility = facilities.find(
                    (f) => f.facilityId == subscription.facilityId
                );
                if (!facility) {
                    throw new Error(
                        'Unable to locate facility within organization, facility ID: ' +
                            subscription.facilityId
                    );
                }
    
                systemUsage = orgUsageMetrics.find(
                    (su) =>
                        su.facilityId == subscription.facilityId &&
                        su.orgInternalName == subscription.orgInternalName
                );
                if (!systemUsage) {
                    console.log(orgUsageMetrics);
                    console.log(facility);
                    throw new Error(
                        'Unable to locate system usage for facility: ' +
                            subscription.orgInternalName +
                            ':' +
                            subscription.facilityId
                    );
                }
            }

            console.log(JSON.stringify(systemUsage,null,4));

            for (let product of subscription.products) {
                /*
                public getActiveSubscriptionsForOrg(orgInternalName:string, month:string):Subscription[] {
                    return this.getSubscriptionsForOrg(orgInternalName).filter((os) => {
                        return os.startDate != null && (os.endDate == null || moment(month,'YYYY-MM').isBefore(moment(os.endDate, 'YYYY-MM-DD')));
                    })
                }
                */
               var firstDayOfNextMonth = moment(this.subscriptionMonth,'YYYY-MM').add(1,'month').startOf('month');
               console.log('START OF NEXT MONTH: ' + firstDayOfNextMonth.toISOString());
               if(product.endDate != null && moment(product.endDate,'YYYY-MM-DD').isBefore(firstDayOfNextMonth)) {
                   console.log(' - Skipping product as it has an end date set: ' + product.productType.productTitle + ' ' + product.subscriptionProductId);
                   continue;
               }

                let invoiceItem = new InvoiceItem();
                invoiceItem.subscription = subscription;
                invoiceItem.subscriptionId = subscription.subscriptionId;
                invoiceItem.subscriptionProductId = product.subscriptionProductId;
                invoiceItem.productName = product.productType.productTitle;
                invoiceItem.sku = product.productType.sku;
                invoiceItem.standardRate = product.productType.rate;
                invoiceItem.discountType = product.discountType;
                invoiceItem.discountAmount = product.discountAmount;
                invoiceItem.actualRate = product.calculateActualRate();
                invoiceItem.displayPriority = product.productType.displayPriority;
                invoiceItem.hasRateOverride = product.rateOverride != null;
                invoiceItem.isUnpublishedProduct = product.productType.unpublished != null;
                invoiceItem.productType = product.productType.productType;

                switch (product.productType.billingType) {
                    case BillingType.MeteredMonthly:
                    case BillingType.BaseFeePlusOverage:

                        invoiceItem.metric = product.productType.meteredQuantityMetric;
                        if (product.metricOverride) {
                            invoiceItem.metric = product.metricOverride;
                        }

                        let description = product.productType.description || 'Software Subscription Fee';
                        let hasIncludedUnits = false;

                        if(_.isNumber(product.productType.includedUnits) && product.productType.includedUnits > 0) {
                            hasIncludedUnits = true;
                            description += ' (Exceeded included ' + product.productType.includedUnits + ' ' + _.toLower(ProductType.getQuantityActionLabel(invoiceItem.metric)) + ') ';
                        }
                        else {
                            description += ' - ' + ProductType.getQuantityActionLabel(invoiceItem.metric) + ' ';
                        }

                        switch (invoiceItem.metric) {
                            case QuantityMetric.CasesCreated: invoiceItem.quantity = systemUsage.casesCreated; break;
                            case QuantityMetric.CasesPerformed: invoiceItem.quantity = systemUsage.casesPerformed; break;
                            case QuantityMetric.DataEntryPerformed: invoiceItem.quantity = systemUsage.dataEntryPerformed; break;
                            case QuantityMetric.ImportBatchRecordsCreated: invoiceItem.quantity = systemUsage.recordsImported; break;
                            case QuantityMetric.Facility: invoiceItem.quantity = _.isArray(activeFacilities) ? activeFacilities.length : 0; break;
                            case QuantityMetric.ReportingProvider:
                                throw new Error(
                                    'Unable to create invoice, metric ReportingProvider not supported.'
                                );
                            default:
                                throw new Error(
                                    'Unable to create invoice, unknown metered item metric: ' +
                                        invoiceItem.metric
                                );
                        }
                        
                        if(hasIncludedUnits) {
                            invoiceItem.quantity -= product.productType.includedUnits;
                            invoiceItem.quantity = Math.max(invoiceItem.quantity,0);
                        }
                        invoiceItem.description =
                            description +
                            this.formatThousands(invoiceItem.quantity,0) +
                            ' @ ' +
                            this.formatCurrency(invoiceItem.actualRate) +
                            '/' + ProductType.getQuantityMetricLabel(invoiceItem.metric);

                        break;
                    case BillingType.FixedMonthly:
                        invoiceItem.quantity = 1;
                        if(Number.isInteger(product.fixedQuantity)) {
                            invoiceItem.quantity = product.fixedQuantity;
                        }
                        invoiceItem.description = product.productType.description || '';
                        break;
                    case BillingType.PercentOfCollections:
                        invoiceItem.quantity = 1;
                        invoiceItem.description = product.productType.description || '';
                        break;
                    case BillingType.FixedOneTime:
                        let setupDateMonth = product.setupDate;
                        // if the setup date is in the current subscription month we are calculating then we 
                        // bill the setup fee.
                        if(_.startsWith(product.setupDate, this.subscriptionMonth)) {
                            invoiceItem.description = product.productType.description || '';
                            invoiceItem.quantity = 1;
                            if(Number.isInteger(product.fixedQuantity)) {
                                invoiceItem.quantity = product.fixedQuantity;
                            }
                        }
                        else {
                            continue;
                        }
                        break;
                    case BillingType.SeatLicense:
                    case BillingType.FixedAnnual:
                    case BillingType.MeteredAnnual:
                        console.log(' - Billing engine does not support subscription products with billing type: ' + product.productType.billingType);
                        continue;
                    default:
                        throw new Error(
                            'Unable to generate invoice, unknown billing type: ' +
                                product.productType.billingType
                        );
                }

                // Add additional text based on the product configuration to the invoice item.
                if(product.additionalDescriptionText) {
                    if(invoiceItem.description) {
                        invoiceItem.description += ' - ';
                    }
                    invoiceItem.description += product.additionalDescriptionText;
                }

                // We calculate the total of the invoice item.
                invoiceItem.total = invoiceItem.actualRate * invoiceItem.quantity;

                // If a rate override is set, we calculate how much of a total discount is applied.
                if(!invoiceItem.hasRateOverride) {
                    invoiceItem.totalDiscount =
                        invoiceItem.total - invoiceItem.standardRate * invoiceItem.quantity;
                }
                else {
                    invoiceItem.totalDiscount = 0;
                }
                // If there is a discount, then we add a description to the invoice item to make the
                // customer aware of the discount.
                if (invoiceItem.totalDiscount != 0) {
                    if(invoiceItem.description) {
                        invoiceItem.description += ' - ';
                    }
                    invoiceItem.description +=
                        'Standard rate ' +
                        this.formatCurrency(invoiceItem.standardRate) +
                        ' discounted ';
                    if (invoiceItem.discountType == DiscountType.Fixed) {
                        invoiceItem.description +=
                            this.formatCurrency(invoiceItem.discountAmount);
                    } else if (invoiceItem.discountType == DiscountType.Percentage) {
                        invoiceItem.description +=
                            Math.floor(invoiceItem.discountAmount * 100) + '%';
                    }
                }

                for(let commissionRate of product.commissionRates) {
                    let c = new Commission();
                    c.invoice = this;
                    c.commissionRate = commissionRate.commissionRate;
                    c.productName = product.productType.productTitle;
                    c.subscriptionProduct = product;
                    c.salesPerson = commissionRate.salesPerson;
                    c.productTotal = invoiceItem.total;
                    c.commissionAmount = Math.round( (invoiceItem.total * (commissionRate.commissionRate/100)) * 100 ) / 100;
                    c.facilityId = subscription.facilityId;
                    c.facilityName = subscription.facilityName;
                    c.orgInternalName = subscription.orgInternalName;
                    c.organizationName = subscription.organizationName;
                    this.commissions.push(c);
                }

                let hideInvoiceItem = product.productType.hideIfEmpty == true && invoiceItem.quantity == 0;

                if(!hideInvoiceItem)
                    this.items.push(invoiceItem);
            }

            if(this.items.length == 0) {
                console.log('==== NO ITEMS IN INVOICE');
                console.log(subscription.products);
            }
        }
    }
}
