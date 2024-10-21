import Quickbooks from '../services/Quickbooks';
import { QbInvoice } from '../model/quickbooks/QbInvoice';

let quickbooksService:Quickbooks;

export interface QbItem {
    Name: string;
    Sku: string;
    Active: boolean;
    FullyQualifiedName: string;
    Taxable: boolean;
    UnitPrice: number;
    Type: string;
    IncomeAccountRef: {
        value: string;
        name: string;
    };
    PurchaseCost: number;
    Id: string;
    SyncToken: String;
}

export interface CustomerResult {
    PrimaryEmailAddr: {
        Address: string
    }
    SyncToken: string
    domain: string
    GivenName: string
    DisplayName: string
    BillWithParent: boolean
    FullyQualifiedName: string
    CompanyName: string
    FamilyName: string
    sparse: boolean
    PrimaryPhone: {
        FreeFormNumber: string
    }
    Active: boolean
    Job: boolean
    BalanceWithJobs: number
    BillAddr: {
        City: string
        Line1: string
        PostalCode: string
        Lat: string
        Long: string
        CountrySubDivisionCode: string
        Id: string
    }
    PreferredDeliveryMethod: string
    Taxable: boolean
    PrintOnCheckName: string
    Balance: number
    Id: string
    MetaData: {
        CreateTime: string
        LastUpdatedTime: string
    }
}

async function getQuickbooksService():Promise<any> {
    if(!quickbooksService) {
        /* Production: */
        quickbooksService = new Quickbooks(
            'Q0vsQmyGd03FuiLeYHvXRfyIdQUREcGppSO2X2Skcal11Y51GS', // Client ID / Consumer Key
            'F3TDhMd82Nk9yleKD8aN6OsinujoLopL07CrMZ0u', // Client Secret / Consumer Secret
            'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..iY03YW2PVXupc6XvRY-dbQ.5k4f2THX4RXIEAVYqDYyCTRkZlWyMzWP6EZYrX6Y8ew9q8yiZVIx-RCEoUqwws5dVevAU0aY5TLBkYprLsHLzSzXFvqqJrB6xHp4G1uHb9CgLqdvxwzfA1rfM1e1KFqzFQg1tnf1Ukqi3iLx68TU3zYsZezcYHyEZmxTENyj5jogsCGovInri8IBNq5D_0aVK7kiDFAmJLjH9eLCKY1Zx5Wfj8-9z3__q2CXYrlfCfK-TyTELl4jJu3UQasEQ8XwGqhf-8eScSCvgTx3FNub8Na0aG_y5YMb8PU7uDQ4YHjUwpK_7nnGuAql3wzarJAzwp0ua_Yur6SHjazf7Mq8tqckcrZuvE2A4YJ-5B_RHrfKBxv7XHzLKDfhmokgfhmvQQCAvLYT-XxNZuZkUeHw53SfckOy8bl7TgmHC6-Mz8tfZIOtpOFBwiXRkPvst_qBV8pluzSKfynPooEJGVf9djij5u7ZqDDk-5IrAN52SG4SJc3d2EnnwAElQdoxQqbdrfYLVT8Pe02EAt_-PBkVhPgdpadOFKx8NiEh6_TJ1IEKv2EhSy-ADWyc3_BiMLh8ywxDC3-8kSVnFNAnuAaOg0yXTfGDWfLDRXaxPaAzMCKSdYOjc7gosqxA39R26gk4fGSuPdF9_0U8hk171l6BGb8Q2QFnFSOOulbA_Ds_vKwFvf0NdPBingtb3MDh4clNuQQNwR9FhLKk1DL7brfRDg.H1ozqjB-Sk75ZzQ7M1FIjg', // a
            null, // Token Secret, not required for OAuth 2.0
            '729694020', // Realm ID
            false, // use the sandbox?
            false, // enable debugging?
            4, // set minorversion
            '2.0', // OAuth version
            'AB11683940028ncVtBpKYJwfN2sCuaD1FFwvflLPCRQyKS6kAH' // refresh token
        );

        /* Sandbox
        quickbooksService = new Quickbooks(
            'Q0jKiQTC5aVNcmf4x4GB7z03xNC15wIuJI3DRFXvT49hp7MGYe', // Client ID / Consumer Key
            'NQ5GwztrxPxoVotAAnRslMyKSl06zFnhy7DaAgVo', // Client Secret / Consumer Secret
            'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..nTd9UVBQqZzwnL6yVrKRiA.ySmDDJ6r4eFEmhhOBghj0FY6-q3Y2LrMtATFSMG9RJ_Ry0KuVX_CuUBK_er_4HB5wndCCcnExfjIjN49cmSG2P83dEPsdgrn4EcIzhvRrX9tWXuqjVWZop6ITN7gOHYQSuj6TBlxr6ncGgTanHPJsYeHkNOtPtqeGr0lS5b5o98er0LPDvTgw6LACA3HO4f9m_ovACnw1F4n8F03fPriY7bdufY2Udm0hUKoKWVvw64LgPwYit2BMgheFYRRByHLa9YhpIusKWdFFp20167NgkTtbpVKml2AF9wNpyaTMBQ1rAEqUPTFd-54a9KEKQGOoq3hLvV-V3INnyOdaXIW5SsgZV2NDcx5V-hLIWwL17oA7Tj2Yfpz06wDl80AbzoW8k9d4Fz65k8wU0CEMtV0I3FEOSsx2FhPdzzKgI5G3eRe576JoSd3cDSlwJgD6Dda28rzYnY04po-Ctfhxsmosoik2T_Jn_CfwLJ_TJsxonOMA8_4QXPwu3uUrsOAI2b_S7NbxpnDkqoQY6qx1s3o-kD5tEf94m_iNertjia3s9kxLetJvjTwxMYMUKGwqkmCEzHQF1MiR6NbFVYENgjGCyRyBWsH678vzp2r7uVW4XtPyxMuzHXudH5Ywz976NdtzhX2Dy9sFzB1NL4PLSfxtHDiq_JU9UOJjaJApl8qzpWyvw6AsAiP33-n52-KsyPoxzKw4VTKsEceZK9D1yflRjSUjaC3I7EE4JhKAYBi6xKsA3BI21woPc-doT3hCXjaKPMVD9cQ3WC88wuYghbwZcuyuW-zJPfv1rrBMFv6VU9JWqWJakPZNuXBLJLlG-BAtiMTJXUEuHPyx1HaNrU5Fw.ccugvzf6PyEIGXR7EQJxWw', // a
            null, // Token Secret, not required for OAuth 2.0
            '123146077545749', // Realm ID
            true, // use the sandbox?
            false, // enable debugging?
            4, // set minorversion
            '2.0', // OAuth version
            'L011555097791YN9Q5XcVlURtSj2fRPwTkFEpqLiWWTdhrJNkr' // refresh token
        ); */

        let refreshResult = await quickbooksService.refreshAccessTokenAsync();              
        /* Production: */
        quickbooksService = new Quickbooks(
            'Q0vsQmyGd03FuiLeYHvXRfyIdQUREcGppSO2X2Skcal11Y51GS', // Client ID / Consumer Key
            'F3TDhMd82Nk9yleKD8aN6OsinujoLopL07CrMZ0u', // Client Secret / Consumer Secret
            refreshResult.access_token, // a
            null, // Token Secret, not required for OAuth 2.0
            '729694020', // Realm ID
            false, // use the sandbox?
            false, // enable debugging?
            4, // set minorversion
            '2.0', // OAuth version
            'AB11683940028ncVtBpKYJwfN2sCuaD1FFwvflLPCRQyKS6kAH' // refresh token
        );

        /* Sandbox:
        quickbooksService = new Quickbooks(
            'Q0jKiQTC5aVNcmf4x4GB7z03xNC15wIuJI3DRFXvT49hp7MGYe', // Client ID / Consumer Key
            'NQ5GwztrxPxoVotAAnRslMyKSl06zFnhy7DaAgVo', // Client Secret / Consumer Secret
            refreshResult.access_token, // a
            null, // Token Secret, not required for OAuth 2.0
            '123146077545749', // Realm ID
            true, // use the sandbox?
            false, // enable debugging?
            4, // set minorversion
            '2.0', // OAuth version
            'L011555097791YN9Q5XcVlURtSj2fRPwTkFEpqLiWWTdhrJNkr' // refresh token
        );
        */

    }
    return quickbooksService;
}

export async function getAllProducts():Promise<QbItem[]> {
    let service = await getQuickbooksService();
    let productResponse = await service.findItemsAsync({
        fetchAll: true
    });

    if(productResponse.QueryResponse) {
        let products = productResponse.QueryResponse.Item;
        return products;
    }
    else {
        return [];
    }
}

export async function createInvoice(invoice:QbInvoice):Promise<any> {
    let service = await getQuickbooksService();
    let result = await service.createInvoiceAsync(invoice);
    return result;
}

export async function getTermId(termName:string):Promise<string> {
    let service = await getQuickbooksService();
    let response = await service.findTermsAsync([
        { field: 'Name', value: termName, operator:'=' }
    ]);
    
    if(response.QueryResponse && response.QueryResponse.Term.length == 1) {
        return <string>response.QueryResponse.Term[0].Id;
    }
    else {
        throw new Error('Unable to find term with name \'' + termName + '\'.');
    }
}

export async function getCustomer(customerId:string):Promise<CustomerResult> {
    let service = await getQuickbooksService();
    let result = await service.getCustomerAsync(customerId);
    
    if(result) {
        return result;
    }
    else {
        return null;
    }
}

export async function getCustomerPrimaryEmail(customerId:string):Promise<string> {
    let service = await getQuickbooksService();
    let result = await service.getCustomerAsync(customerId);
    
    if(result && result.PrimaryEmailAddr) {
        return result.PrimaryEmailAddr.Address;
    }
    else {
        return null;
    }
}

export async function getClassId(className:string):Promise<string> {
    let service = await getQuickbooksService();
    let response = await service.findClassesAsync([
        { field: 'Name', value: className, operator:'=' }
    ]);
    
    if(response.QueryResponse && response.QueryResponse.Class && response.QueryResponse.Class.length == 1) {
        return <string>response.QueryResponse.Class[0].Id;
    }
    else {
        throw new Error('Unable to find term with name \'' + className + '\'.');
    }
}