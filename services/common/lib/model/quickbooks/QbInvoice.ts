export interface MetaData {
    CreateTime: Date;
    LastUpdatedTime: Date;
}

export interface CustomField {
    DefinitionId: string;
    Name?: string;
    Type?: string;
    StringValue?: string;
}

export interface LinkedTxn {
    TxnId: string;
    TxnType: string;
}

export interface ItemRef {
    value: string;
    name?: string;
}

export interface TaxCodeRef {
    value: string;
}

export interface ServiceDate {
    date: string;
}

export interface SalesItemLineDetail {
    ItemRef?: ItemRef;
    UnitPrice?: number;
    Qty?: number;
    TaxCodeRef?: TaxCodeRef;
}

export interface SubTotalLineDetail {
}

export interface DescriptionLineDetail {
    ServiceDate?: ServiceDate;
    TaxCodeRef?: TaxCodeRef;
}

export interface Line {
    Id?: string;
    LineNum?: number;
    Description?: string;
    Amount?: number;
    DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DescriptionOnly';
    SalesItemLineDetail?: SalesItemLineDetail;
    SubTotalLineDetail?: SubTotalLineDetail;
    DescriptionLineDetail?: DescriptionLineDetail;
}

export interface TxnTaxCodeRef {
    value: string;
}

export interface TaxRateRef {
    value: string;
}

export interface TaxLineDetail {
    TaxRateRef: TaxRateRef;
    PercentBased: boolean;
    TaxPercent: number;
    NetAmountTaxable: number;
}

export interface TaxLine {
    Amount: number;
    DetailType: string;
    TaxLineDetail: TaxLineDetail;
}

export interface TxnTaxDetail {
    TxnTaxCodeRef: TxnTaxCodeRef;
    TotalTax: number;
    TaxLine: TaxLine[];
}

export interface CustomerRef {
    value: string;
    name: string;
}

export interface CustomerMemo {
    value: string;
}

export interface BillAddr {
    Id: string;
    Line1: string;
    Line2: string;
    Line3: string;
    Line4: string;
    Lat: string;
    Long: string;
}

export interface ShipAddr {
    Id: string;
    Line1: string;
    City: string;
    CountrySubDivisionCode: string;
    PostalCode: string;
    Lat: string;
    Long: string;
}

export interface SalesTermRef {
    value: string;
}

export interface BillEmail {
    Address: string;
}

export interface QbInvoice {
    Deposit?: number;
    domain?: string;
    sparse?: boolean;
    Id?: string;
    SyncToken?: string;
    MetaData?: MetaData;
    CustomField?: CustomField[];
    DocNumber?: string;
    TxnDate?: string;
    LinkedTxn?: LinkedTxn[];
    Line: Line[];
    TxnTaxDetail?: TxnTaxDetail;
    CustomerRef: CustomerRef;
    CustomerMemo?: CustomerMemo;
    BillAddr?: BillAddr;
    ShipAddr?: ShipAddr;
    SalesTermRef?: SalesTermRef;
    DueDate?: string;
    TotalAmt?: number;
    ApplyTaxAfterDiscount?: boolean;
    PrintStatus?: string;
    EmailStatus?: string;
    BillEmail?: BillEmail;
    Balance?: number;
    AllowOnlineACHPayment: boolean;
    AllowOnlineCreditCardPayment: boolean;
    ClassRef: {
        value: string;
    };
}