import { SubscriptionProduct } from "../model/billing/SubscriptionProduct";
import { ProductType } from "../model/billing/ProductType";
import { Subscription } from "../model/billing/Subscription";
import { PlanType } from "../model/billing/PlanType";

import * as moment from 'moment';
import { SalesPerson } from "../model/billing/SalesPerson";
import { CommissionRate } from "../model/billing/CommissionRate";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

var Airtable = require('airtable');


export class AirtableSubscriptionService {

    static API_KEY:string = "keyTR70wONk84kJTw";
    static BASE_ID:string = "apprd5hQcPu2xQhG6";
    
    static subscriptionProductsCache:SubscriptionProduct[];
    static subscriptionsCache:Subscription[];
    static productTypesCache:ProductType[];
    static planTypesCache:PlanType[];
    static salesTeamCache:SalesPerson[];
    static commissionRatesCache:CommissionRate[];

    private subscriptionProducts:SubscriptionProduct[];
    private subscriptions:Subscription[];
    private productTypes:ProductType[];
    private planTypes:PlanType[];
    private salesTeam:SalesPerson[];
    private commissionRates:CommissionRate[];

    static instance:AirtableSubscriptionService;

    static async base(useFileCache:boolean = false):Promise<AirtableSubscriptionService> {
        var loadedCacheData = false;
        let cacheFolder = path.join(os.tmpdir(),'ghsubscriptions');
        let cacheFilePath = path.join(cacheFolder,'data_1.json');

        if(useFileCache) {
            console.log('Attempting to load subscription data from cache...');
            if(fs.existsSync(cacheFilePath)) {
                console.log('Cache found.');
                let cacheData = JSON.parse(fs.readFileSync(cacheFilePath).toString());
                AirtableSubscriptionService.subscriptionProductsCache = cacheData.subscriptionProductsCache;
                AirtableSubscriptionService.subscriptionsCache = cacheData.subscriptionsCache;
                AirtableSubscriptionService.productTypesCache = cacheData.productTypesCache;
                AirtableSubscriptionService.planTypesCache = cacheData.planTypesCache;
                AirtableSubscriptionService.salesTeamCache = cacheData.salesTeamCache;
                AirtableSubscriptionService.commissionRatesCache = cacheData.commissionRatesCache;
                loadedCacheData = true;
            }
            else {
                console.log('Cache NOT found.');
            }
        }

        
        if(!loadedCacheData) {
            console.log('Loading data from Airtable.com...');
            if(!AirtableSubscriptionService.instance) {
                AirtableSubscriptionService.instance = new AirtableSubscriptionService();
                await AirtableSubscriptionService.instance.refreshBase(loadedCacheData);
            }

            console.log('Storing cache...');
            if(!fs.existsSync(cacheFolder)) {
                console.log('Creating cache directory.')
                fs.mkdirSync(cacheFolder);
            }
                
            fs.writeFileSync(cacheFilePath, JSON.stringify({
                subscriptionProductsCache: AirtableSubscriptionService.subscriptionProductsCache,
                subscriptionsCache: AirtableSubscriptionService.subscriptionsCache,
                productTypesCache: AirtableSubscriptionService.productTypesCache,
                planTypesCache: AirtableSubscriptionService.planTypesCache,
                salesTeamCache: AirtableSubscriptionService.salesTeamCache,
                commissionRatesCache: AirtableSubscriptionService.commissionRatesCache
            }));
        }
            
        return AirtableSubscriptionService.instance;
    }

    public getSubscriptionsForOrg(orgInternalName:string):Subscription[] {
        return this.subscriptions.filter((s) => s.orgInternalName == orgInternalName);
    }

    public getActiveSubscriptionsForOrg(orgInternalName:string, month:string):Subscription[] {
        return this.getSubscriptionsForOrg(orgInternalName).filter((os) => {
            return os.startDate != null && (os.endDate == null || moment(month,'YYYY-MM').isBefore(moment(os.endDate, 'YYYY-MM-DD')));
        })
    }

    public getAllActiveSubscriptions(month:string):Subscription[] {
        return this.subscriptions.filter((os) => {
            return os.startDate != null && (os.endDate == null || moment(month,'YYYY-MM').isBefore(moment(os.endDate, 'YYYY-MM-DD')));
        })
    }

    public getSubscriptionsForCustomer(customerId:String):Subscription[] {
        return this.subscriptions.filter((s) => s.customerId == customerId);
    }

    public getProductTypes():ProductType[] {
        return this.productTypes;
    }
    
    public getPlanTypes():PlanType[] {
        return this.planTypes;
    }

    public getActivePlanTypes():PlanType[] {
        return this.planTypes.filter((pt) => {
            let today = new Date();
            return pt.published != null && (pt.unpublished == null || moment().isBefore(moment(pt.unpublished, 'YYYY-MM-DD')));
        });
    }

    private service():any {
        return new Airtable({ apiKey: AirtableSubscriptionService.API_KEY }).base(AirtableSubscriptionService.BASE_ID);
    }

    private removeEmptyStrings(fields:any) {
        // tslint:disable-next-line:forin
        for(let fieldName in fields) {
            if(fields[fieldName] == "") {
                fields[fieldName] = null;
            }
        }
    }

    private async refreshBase(useCache:boolean) {
        
        if(useCache && AirtableSubscriptionService.salesTeamCache) {
            this.salesTeam = AirtableSubscriptionService.salesTeamCache;
        }
        else {
            await this.loadAllSalesTeam();
        }

        if(useCache && AirtableSubscriptionService.productTypesCache) {
            this.productTypes = AirtableSubscriptionService.productTypesCache;
        }
        else {
            await this.loadAllProductTypes();
        }

        if(useCache && AirtableSubscriptionService.planTypesCache) {
            this.planTypes = AirtableSubscriptionService.planTypesCache;
        }
        else {
            await this.loadAllPlanTypes();
        }

        if(useCache && AirtableSubscriptionService.commissionRatesCache) {
            this.commissionRates = AirtableSubscriptionService.commissionRatesCache;
        }
        else {
            await this.loadAllCommissionRates(this.salesTeam, this.subscriptionProducts);
        }

        if(useCache && AirtableSubscriptionService.subscriptionProductsCache) {
            this.subscriptionProducts = AirtableSubscriptionService.subscriptionProductsCache;
        }
        else {
            await this.loadAllSubscriptionProducts(this.commissionRates, this.productTypes);
        }

        if(useCache && AirtableSubscriptionService.subscriptionsCache) {
            this.subscriptions = AirtableSubscriptionService.subscriptionsCache;
        }
        else {
            await this.loadAllSubscriptions(this.planTypes, this.subscriptionProducts, this.salesTeam);
        }
    }

    private async loadAllSalesTeam() {
        this.salesTeam = [];
        await this.service()
            .table('Sales Team')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    this.salesTeam.push(SalesPerson.fromAirtable(record.id, record.fields));
                }
                fetchNextPage();
            });
    }

    private async loadAllProductTypes() {
        this.productTypes = [];
        await this.service()
            .table('Product Types')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    this.productTypes.push(ProductType.fromAirtable(record.id, record.fields));
                }
                fetchNextPage();
            });
    }

    private async loadAllPlanTypes() {
        this.planTypes = [];
        await this.service()
            .table('Plan Types')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    this.planTypes.push(PlanType.fromAirtable(record.id, record.fields));
                }
                fetchNextPage();
            });
    }

    private async loadAllSubscriptionProducts(commissionRates:CommissionRate[], productTypes:ProductType[]) {

        this.subscriptionProducts = [];
        await this.service()
            .table('Subscription Products')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    this.subscriptionProducts.push(
                        SubscriptionProduct.fromAirtable(record.id, record.fields, commissionRates, productTypes)
                    );
                }
                fetchNextPage();
            });
    }

    private async loadAllSubscriptions(planTypes:PlanType[], subscriptionProducts:SubscriptionProduct[], salesTeam:SalesPerson[]) {
        this.subscriptions = [];
        await this.service()
            .table('Subscriptions')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    let sub = Subscription.fromAirtable(record.id, record.fields, planTypes, subscriptionProducts, salesTeam);
                    this.subscriptions.push(sub);
                }
                fetchNextPage();
            });
    }

    private async loadAllCommissionRates(salesTeam:SalesPerson[], subscriptionProducts:SubscriptionProduct[]) {
        this.commissionRates = [];
        await this.service()
            .table('Commission Rates')
            .select()
            .eachPage((records, fetchNextPage) => {
                for (let record of records) {
                    this.removeEmptyStrings(record.fields);
                    let cr = CommissionRate.fromAirtable(record.id, record.fields, salesTeam, subscriptionProducts);
                    this.commissionRates.push(cr);
                }
                fetchNextPage();
            });
    }
}