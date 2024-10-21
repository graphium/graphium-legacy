import { Subscription } from '../../lib/model/billing/Subscription';
import { PlanType } from '../model/billing/PlanType';
import { SubscriptionProduct } from '../model/billing/SubscriptionProduct';
import { ProductType } from '../model/billing/ProductType';
import { Invoice } from '../model/billing/Invoice';
import * as SystemUsageDAO from '../dao/SystemUsageDAO';
import * as QuickbooksService from '../dao/QuickbooksService';
import * as OrganizationDAO from '../dao/org/FacilityDAO';
import * as IndexOrganizationDAO from '../dao/index/IndexOrganizationDAO';
import { GetSystemUsageByOrgResults } from '../dao/SystemUsageDAO';
import { QbInvoice } from '../model/quickbooks/QbInvoice';

import * as moment from 'moment';
import * as _ from 'lodash';
import { AirtableSubscriptionService } from './AirtableSubscriptionService';
var Airtable = require('airtable');

function base() {
    return new Airtable({ apiKey: AirtableSubscriptionService.API_KEY }).base(AirtableSubscriptionService.BASE_ID);
}

export async function generateInvoicesForOrg(orgInternalName:string, month:string, generateSeperateInvoices:boolean = false):Promise<Invoice[]> {
    let airtable = await AirtableSubscriptionService.base();
    let organization = await IndexOrganizationDAO.getOrgByOrgNameInternal(orgInternalName);
    let facilities = await OrganizationDAO.getFacilities(orgInternalName);

    console.log(' - Retrieving system usage for organization...');
    let orgUsageMetrics:GetSystemUsageByOrgResults[] = await SystemUsageDAO.getSystemUsageByOrg(orgInternalName, month);
    console.log(' - Retrieving active subscriptions for org...');
    let activeOrgSubscriptions = airtable.getActiveSubscriptionsForOrg(orgInternalName, month);

    let invoices:Invoice[] = [];
    //let subscriptionsToRollup:Subscription[] = [];
    let namedSubscriptionGroups:Subscription[][] = [];
    let separateInvoiceSubscriptions:Subscription[] = [];
    let orgInvoiceSubscriptions:Subscription[] = [];

    for(let subscription of _.sortBy(activeOrgSubscriptions,['subscriptionTitle'])) {
        console.log(' - generating invoice for subscription: ' + subscription.subscriptionTitle);

        // Check to make sure this facility is active and exists.
        if(_.isNumber(subscription.facilityId)) {
            let facility = facilities.find((f) => f.facilityId == subscription.facilityId);
            if(!facility || facility.activeIndicator == false) {
                console.log(' !! Warning, inactive or missing facility for subscription: ' + subscription.subscriptionTitle + ' (' + subscription.subscriptionId + ')');
                continue;
            }
        }

        if(generateSeperateInvoices === true) {
            console.log('Adding subscription as SEPARATE invoice: ' + subscription.subscriptionTitle);
            separateInvoiceSubscriptions.push(subscription);
        }
        else if(!subscription.separateInvoice) {
            //let i = new Invoice();
            //i.generateInvoiceItems(subscription.qbCustomerId, [subscription], month, organization, facilities, orgUsageMetrics)
            //invoices.push(i);
            console.log('Adding subscription to ORG invoice: ' + subscription.subscriptionTitle);
            orgInvoiceSubscriptions.push(subscription);
        }
        else {
            if(subscription.invoiceGroup) {
                console.log('Adding subscription to "' + subscription.invoiceGroup + '" GROUP: ' + subscription.subscriptionTitle);
                // First find if we have a group that matches the invoice group name
                // if it is specified.
                let existingSubscriptionGroup = namedSubscriptionGroups.find((sg:Subscription[], index:number, obj:Subscription[][]) => {
                    return sg.length > 0 && sg[0].invoiceGroup == subscription.invoiceGroup;
                });

                if(existingSubscriptionGroup) {
                    console.log(' - Found existing group, adding this subscription.');
                    existingSubscriptionGroup.push(subscription);
                }
                else {
                    console.log(' - No existing group, creating new group.');
                    namedSubscriptionGroups.push([subscription]);
                }
            }
            else {
                console.log('Adding subscription as SEPARATE invoice: ' + subscription.subscriptionTitle);
                separateInvoiceSubscriptions.push(subscription);
            }
        }
    }

    if(namedSubscriptionGroups.length > 0) {
        invoices = invoices.concat(generateInvoicesFromSubscriptions(namedSubscriptionGroups, month, organization, facilities, orgUsageMetrics));
    }
    if(separateInvoiceSubscriptions.length > 0) {
        for(let separateInvoiceSubscription of separateInvoiceSubscriptions) {
            invoices = invoices.concat(generateInvoicesFromSubscriptions([[separateInvoiceSubscription]], month, organization, facilities, orgUsageMetrics));
        }
    }
    if(orgInvoiceSubscriptions.length > 0) {
        invoices = invoices.concat(generateInvoicesFromSubscriptions([orgInvoiceSubscriptions], month, organization, facilities, orgUsageMetrics));
    }
    console.log('Generated ' + invoices.length + ' total invoices.');
    return invoices;
}

function generateInvoicesFromSubscriptions(subscriptionGroups:Subscription[][], month, organization, facilities, orgUsageMetrics):Invoice[] {
    let invoices:Invoice[] = [];
    for(let subscriptionGroup of subscriptionGroups) {
        let i = new Invoice();
        i.generateInvoiceItems(subscriptionGroup[0].qbCustomerId, subscriptionGroup, month, organization, facilities, orgUsageMetrics)
        invoices.push(i);
    }
    return invoices;
}

function generateQbInvoice(invoice:Invoice, qbProductTypes:QuickbooksService.QbItem[], termId:string, classId:string, customerEmail:string):QbInvoice {
    let qbi = <QbInvoice> {
        SalesTermRef: { value: termId },
        CustomerRef: {
            value: invoice.qbCustomerId.toString()
            //value: "1"
        },
        ClassRef: {
            value: classId
        },
        BillEmail: {
            Address: customerEmail
        },
        Line: [],
        AllowOnlineACHPayment: true
    }

    if(invoice.subscriptions[0].accountOwner) {
        qbi.CustomField = [{
            DefinitionId: "2",
            Name: "Sales Rep",
            Type: "StringType",
            StringValue: invoice.subscriptions[0].accountOwner.firstName + " " + invoice.subscriptions[0].accountOwner.lastName
        }];
    }

    if(invoice.subscriptions[0].poNumber) {
        if(!qbi.CustomField) {
            qbi.CustomField = [];
        }
        qbi.CustomField.push({
            DefinitionId: "1",
            Name: "P.O. Number",
            Type: "StringType",
            StringValue: invoice.subscriptions[0].poNumber
        });
    }

    let itemGroups = _.groupBy(invoice.items, (ii) => { return ii.subscription.subscriptionId });
    // tslint:disable-next-line:forin
    for(let subscriptionId in itemGroups) {
        let items = itemGroups[subscriptionId];

        let facilityOrOrgName = items[0].subscription.organizationName;
        if(items[0].subscription.facilityId != null) {
            facilityOrOrgName = invoice.facilities.find((f) => f.facilityId == items[0].subscription.facilityId).facilityName;
        }

        qbi.Line.push({
            Description: facilityOrOrgName + ' - Services Provided ' + moment(invoice.subscriptionMonth,'YYYY-MM').format('MMMM YYYY'),
            DetailType: 'DescriptionOnly',
            DescriptionLineDetail: {}
        });

        //console.log('==== Before Sort ====');
        //console.log(items.map((i) => i.productName + ':' + i.displayPriority));
        let orderedItems = _.sortBy(items, ['displayPriority', 'productName'], ['asc', 'asc']);
        //console.log('==== Before Sort ====');
        //console.log(items.map((i) => i.productName + ':' + i.displayPriority));

        for(let item of orderedItems) {
            qbi.Line.push({
                Description: item.description,
                Amount: item.total,
                DetailType: 'SalesItemLineDetail',
                SalesItemLineDetail: {
                    ItemRef: {
                        value: qbProductTypes.find((qbp) => qbp.Sku == item.sku).Id
                    },
                    Qty: item.quantity,
                    UnitPrice: item.actualRate
                }
            })
        }
        qbi.Line.push({
            Description: 'Subtotal:',
            DetailType: 'DescriptionOnly',
            DescriptionLineDetail: {}
        });
        qbi.Line.push({
            Description: '',
            DetailType: 'DescriptionOnly',
            DescriptionLineDetail: {}
        });
    }

    return qbi;
}

export async function createQbInvoices(invoices:Invoice[]) {
    console.log(' - retrieving airtable product types...');
    let airtableProductTypes = (await AirtableSubscriptionService.base()).getProductTypes();
    console.log(' - retrieving quickbooks product types...');
    let qbProductTypes = await QuickbooksService.getAllProducts();
    console.log(' - looking up Net 30 term id...');
    let net30TermId = await QuickbooksService.getTermId('Net 30');
    console.log(' - looking up General Operations class id...');
    let generalOperationsClassId = await QuickbooksService.getClassId('General Operations');

    // First we determine which products are missing in quickbooks before we create
    // the invoices in Quickbooks.
    let missingSkus = [];
    let nameWarnings = [];
    for(let atProduct of airtableProductTypes) {
        console.log(' - Looking up QB product for Airtable product: ' + atProduct.productTitle);
        let matches = qbProductTypes.filter((qbi) => qbi.Sku == atProduct.sku);
        if(matches.length > 1) {
            missingSkus.push('There are multiple items in Quickbooks with the SKU (' + atProduct.sku +'). SKUs must be unique in quickbooks.');
        }
        else if(matches.length < 1) {
            missingSkus.push('Unable to find Quickbook Product with SKU: ' + atProduct.sku );
        }
        else {
            if(matches[0].Name != atProduct.productTitle) {
                nameWarnings.push('Product names for item with SKU (' + atProduct.sku + ') does not match.');
            }
        }
    }

    if(missingSkus.length > 0) {
        console.log('Errors finding SKUs for products:');
        console.log(missingSkus);
        throw new Error('Unable to create invoices, products in Graphium (Airtable) do not match products in Quickbooks.');
    }
    if(nameWarnings.length > 0) {
        console.log('Warning, names in Quickbooks products to not match those in airtable:');
        console.log(nameWarnings);
    }

    let persistedInvoices = [];
    for(let invoice of invoices) {
        try {
            console.log(' - getting customer email...');
            let customerEmail = await QuickbooksService.getCustomerPrimaryEmail(invoice.subscriptions[0].qbCustomerId.toString());
            console.log(' - generating qb invoice create request...');
            let qbi = generateQbInvoice(invoice, qbProductTypes, net30TermId, generalOperationsClassId, customerEmail);
            console.log(' - saving invoice to quickbooks...');
            let invoiceResult = await QuickbooksService.createInvoice(qbi);
            console.log(' - QBO invoice saved: ' + invoiceResult.DocNumber);
            console.log(' - saving invoice to airtable: ');
            let airtableInvoiceResult = await base().table('Invoices').create(invoice.toAirtable(invoiceResult));

            console.log(' - saved airtable invoice: ' + airtableInvoiceResult.id);
            invoice.invoiceId = airtableInvoiceResult.id;
            for(let invoiceItem of invoice.items) {
                console.log(' - saving invoice item...');
                //let airtableInvoiceItems = invoiceItems.map( (ii) => { return { fields: ii.toAirtable(invoice.invoiceId) } });
                //console.log(JSON.stringify(airtableInvoiceItems,null,4));
                let airtableInvoiceItemResult = await base().table('Invoice Items').create(invoiceItem.toAirtable(airtableInvoiceResult.id));
                console.log(' - saved invoice items.');
            }


            console.log(' - saving commissions ('+invoice.commissions.length+')...');
            for(let commission of invoice.commissions) {
                let atCommission = commission.toAirtable();
                console.log('   - saving commission: ' + commission.productName);
                let airtableCommission = await base().table('Commissions').create(atCommission);
                console.log('   - saved commission');
            }

            persistedInvoices.push(invoiceResult);
        }
        catch(error) {
            console.log(JSON.stringify(error,null,4));
            console.log('Unable to save invoice: ' + error.message);
            console.log(error.stack);
        }
    }
    return persistedInvoices;
}



/*
export async function getAllProductTypes(): Promise<ProductType[]> {
    let productTypes: ProductType[] = [];
    await base()
        .table('Product Types')
        .select()
        .eachPage((records, fetchNextPage) => {
            for (let record of records) {
                productTypes.push(ProductType.fromAirtable(record.id, record.fields));
            }
            fetchNextPage();
        });

    return productTypes;
}

export async function getAllPlanTypes(): Promise<PlanType[]> {
    let planTypes: PlanType[] = [];
    await base()
        .table('Plan Types')
        .select()
        .eachPage((records, fetchNextPage) => {
            for (let record of records) {
                planTypes.push(PlanType.fromAirtable(record.id, record.fields));
            }
            fetchNextPage();
        });

    return planTypes;
}

export async function getProductsForSubscription(
    subscriptionTitle: string
): Promise<SubscriptionProduct[]> {
    console.log('getting products for subscription: ' + subscriptionTitle);
    let productTypes = await getAllProductTypes();
    let products: SubscriptionProduct[] = [];
    await base()
        .table('Subscription Products')
        .select({
            filterByFormula: `{Subscription} = "${subscriptionTitle}"`
        })
        .eachPage((records, fetchNextPage) => {
            console.log('Got products: ' + records);
            for (let record of records) {
                products.push(
                    SubscriptionProduct.fromAirtable(record.id, record.fields, productTypes)
                );
            }
            fetchNextPage();
        });

    return products;
}

export async function getSubscriptionsForOrganization(
    orgInternalName: string
): Promise<Subscription[]> {
    let planTypes = await getAllPlanTypes();
    let subscriptions: Subscription[] = [];

    await base()
        .table('Subscriptions')
        .select({
            filterByFormula: `{Org Internal Name} = "${orgInternalName}"`
        })
        .eachPage((records, fetchNextPage) => {
            for (let record of records) {
                let sub = Subscription.fromAirtable(record.id, record.fields, planTypes);
                subscriptions.push(sub);
            }
            fetchNextPage();
        });

    for (let subscription of subscriptions) {
        console.log('Retrieving products for subscription: ' + subscription.subscriptionTitle);
        let products = await getProductsForSubscription(subscription.subscriptionTitle);
        console.log(products);
        subscription.products = products;
    }

    return subscriptions;
}
*/