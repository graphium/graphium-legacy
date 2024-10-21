import * as request from 'request-promise';

export interface Address {
    address_1: string;
    address_2: string;
    address_purpose: string;
    address_type: string;
    city: string;
    country_code: string;
    country_name: string;
    fax_number: string;
    postal_code: string;
    state: string;
    telephone_number: string;
}

export interface Basic {
    credential: string;
    enumeration_date: string;
    first_name: string;
    gender: string;
    last_name: string;
    last_updated: string;
    name: string;
    name_prefix: string;
    sole_proprietor: string;
    status: string;
}

export interface Identifier {
    code: string;
    desc: string;
    identifier: string;
    issuer: string;
    state: string;
}

export interface Taxonomy {
    code: string;
    desc: string;
    license: string;
    primary: boolean;
    state: string;
}

export interface Provider {
    addresses: Address[];
    basic: Basic;
    created_epoch: number;
    enumeration_type: string;
    identifiers: Identifier[];
    last_updated_epoch: number;
    number: number;
    other_names: any[];
    taxonomies: Taxonomy[];
}

export interface Error {
    field: string;
    number: string;
    description: string;
}

export interface NppesLookupResult {
    result_count: number;
    results: Provider[];
    Errors: Error[];
}

export async function lookupIndividualProvider(npi:string):Promise<Provider> {
    var options = {
        method: 'GET',
        uri: 'https://npiregistry.cms.hhs.gov/api/',
        json: true,
        qs: {
            version: '2.1',
            number: npi,
            enumeration_type: 'NPI-1'
        }
    };

    let result = <NppesLookupResult>(await request(options));
    if(result.Errors) {
        console.error(JSON.stringify(result.Errors,null,4));
        throw new Error('Unable to find provider, request error.');
    }
    else if(result.result_count > 1) {
        throw new Error('Unable to find provider, found more than one match.');
    }
    else if(result.result_count == 0) {
        throw new Error('No providers found with that NPI.');
    }

    return result.results[0];
}