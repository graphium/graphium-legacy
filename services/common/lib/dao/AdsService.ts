import { QueryOptions, QueryTypes } from 'sequelize';
import * as orgModels from '../model/OrgModels.js';

interface CreateAdsTransactionParams {
    orgInternalName:string,
    facilityId:number,
    systemCode:string,
    patientMrn:string,
    encounterNumber?:string,
    createAdsIfNotExists?:boolean,
    transactionTimestamp:Date,
    transactionDetails: {
      transactionId?: string|null,
      fillerOrderNumber: string,
      itemDescription: string,
      itemCode: string,
      quantity: number,
      unitOfMeasure: string,
      transactionTypeCode: string,
      transactionCategory: string,
      dispensingSystemCode: string,
      dispensingSystemName: string,
      deaScheduleClass?:string|null,
      accessControlLevel?: string|null,
      userId:string,
      username: string,
      witnessId: string,
      witnessName: string,
      mi7Message: any,
    }
}

export async function createAdsTransaction(params:CreateAdsTransactionParams):Promise<void> {

  const { facilityId, orgInternalName, systemCode } = params;
  let existingSystem = await getAdsBySystemCode({ orgInternalName, facilityId, systemCode });

  if(!existingSystem) {

    if(params.createAdsIfNotExists === true) {
      await createAds({
        orgInternalName,
        facilityId,
        systemCode,
        displayName: params.systemCode,
        active: true
      });

      existingSystem = await getAdsBySystemCode({ orgInternalName, facilityId, systemCode });
    }
    else {
      throw new Error('Unable to create transaction, system code does not exist for this facility.');
    }
  }

  let query = `
    INSERT INTO ads_transaction (
      fac_id,
      system_id,
      patient_mrn,
      enctr_no,
      transaction_timestamp,
      transaction_details
    ) VALUES (
      :facilityId,
      :systemId,
      :patientMrn,
      :encounterNumber,
      :transactionTimestamp,
      :transactionDetails
    )
  `;

  let options = <QueryOptions>{
      type: QueryTypes.INSERT,
      replacements: {
          facilityId: params.facilityId,
          systemId: existingSystem.systemId,
          patientMrn: params.patientMrn,
          encounterNumber: params.encounterNumber || null,
          transactionTimestamp: params.transactionTimestamp,
          transactionDetails: JSON.stringify(params.transactionDetails)
      }
  };

  let [rows, updateCount] = await orgModels.query( params.orgInternalName, query, options );
  if(updateCount != 1) {
    throw new Error('Unable to create new transaction.');
  }
}


interface CreateAdsParams {
    orgInternalName:string,
    facilityId:number,
    systemCode:string,
    displayName:string,
    active:boolean
}

export async function createAds(params:CreateAdsParams):Promise<void> {

    let existingSystem = await getAdsBySystemCode({ orgInternalName: params.orgInternalName, facilityId: params.facilityId, systemCode:params.systemCode });

    if(existingSystem) {
      throw new Error('Unable to create system, system code already exists for this facility.');
    }

    let query = `
      INSERT INTO automated_dispense_system (
        fac_id,
        system_code,
        display_name,
        actv_ind
      ) VALUES (
        :facilityId,
        :systemCode,
        :displayName,
        :active
      )
    `;

    let options = <QueryOptions>{
        type: QueryTypes.INSERT,
        replacements: {
            facilityId: params.facilityId,
            systemCode: params.systemCode,
            displayName: params.displayName,
            active: params.active
        }
    };

    let [rows, updateCount] = await orgModels.query( params.orgInternalName, query, options );
    if(updateCount != 1) {
      throw new Error('Unable to create new system.');
    }
}

interface GetAdsBySystemCodeParams {
    orgInternalName:string,
    facilityId:number,
    systemCode:string
}

export async function getAdsBySystemCode(params:GetAdsBySystemCodeParams):Promise<{
  systemId:number,
  facilityId:number,
  systemCode:string,
  displayName:string,
  activeIndicator:boolean,
  createdTime:Date,
  updatedTime:Date,
  auditVersion:number
}> {
    let query = `
      SELECT
        system_id as "systemId",
        fac_id as "facilityId",
        system_code as "systemCode",
        display_name as "displayName",
        actv_ind as "activeIndicator",
        ins_dttm as "createdTime",
        upd_dttm as "updatedTime",
        aud_ver as "auditVersion"
      FROM
        automated_dispense_system
      WHERE
        fac_id = :facilityId AND
        system_code = :systemCode
    `;

    let options = <QueryOptions>{
        type: QueryTypes.SELECT,
        replacements: {
            systemCode: params.systemCode,
            facilityId: params.facilityId
        }
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    return rows;
}