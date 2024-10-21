import { getItemFromTypes, getItemsFromTypes } from '../../util/AirtableUtil';
import { SubscriptionProduct } from './SubscriptionProduct';
import { SalesPerson } from './SalesPerson';
import { PlanType } from './PlanType';
import * as _ from 'lodash';

export enum DealType {
    NewBusiness = "NEW_BUSINESS",
    Percentage = "SALES_EXPANSION"
}

export class Subscription {
    _data:any;
    subscriptionId:string;
    subscriptionTitle:string;
    orgInternalName: string;
    customerId:string;
    organizationName: string;
    facilityId:number;
    facilityName: string;
    qbCustomerId: number;
    separateInvoice: boolean | null;
    plan: PlanType;
    products: SubscriptionProduct[];
    startDate: string;
    endDate: string;
    pandaDocUrl: string | null;
    accountOwner: SalesPerson;
    invoiceRequiresReview: boolean | null;
    autoCharge: boolean | null;
    notes: string;
    poNumber: string;
    convertFromAnnualPerProvider:boolean;
    invoiceGroup:string;
    secondarySubscription:boolean;
    masterOrgInternalName:string;
    dealType:string;

    static fromAirtable(id:string, data: any, planTypes?:PlanType[], subscriptionProducts?:SubscriptionProduct[], salesPeople?:SalesPerson[]): Subscription {
        let s = new Subscription();
        s._data = data;
        s.subscriptionId =  id;
        s.subscriptionTitle = data['Subscription Name'];
        s.orgInternalName = data['Org Internal Name'];
        s.organizationName = data['Organization Name'];
        s.customerId = data['Customer ID'] && data['Customer ID'].length > 0 ? data['Customer ID'][0] : null;
        s.facilityId = data['Facility ID'];
        s.facilityName = data['Facility Name'];
        s.qbCustomerId = data['QB ID (Charge)'];
        s.separateInvoice = data['Separate Invoice'];
        if(data['Plan']) s.plan = getItemFromTypes<PlanType>(planTypes, 'planTypeId', data['Plan'][0]);
        s.products = getItemsFromTypes<SubscriptionProduct>(subscriptionProducts, 'subscriptionProductId', data['Products'] );
        s.startDate = data['Start Date'];
        s.endDate = data['End Date'];
        s.pandaDocUrl = data['PandaDoc'];
        if(data['Account Owner']) s.accountOwner = getItemFromTypes<SalesPerson>(salesPeople, 'salesPersonId', data['Account Owner'][0]);
        s.invoiceRequiresReview = data['Invoice Requires Review'];
        s.notes = data['Notes'];
        s.products = subscriptionProducts ? subscriptionProducts.filter((sp) => sp.subscriptionId == s.subscriptionId) : null;
        s.autoCharge = data['Auto Charge'];
        s.poNumber = data['PO Number'];
        s.convertFromAnnualPerProvider = data['Convert from Annual Per Provider'];
        s.secondarySubscription = data['Secondary Subscription'];
        s.invoiceGroup = data['Invoice Group'];
        s.masterOrgInternalName = data['Master Org Internal Name'];
        s.dealType = _.toUpper(_.snakeCase(data['Deal Type'])) as DealType;
        return s;
    }
}