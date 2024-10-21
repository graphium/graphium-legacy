import { Transaction, Sequelize, QueryOptions, QueryTypes, Model, CreateOptions, UpdateOptions } from 'sequelize';
import * as _ from 'lodash';
import * as moment from 'moment';

import * as orgModels from '../model/OrgModels.js';
import { Encounter } from '../model/flow/Encounter';
import * as OrgUserDao from '../dao/org/OrgUserDAO';

interface PatchOrCreateEncounterByEncounterNumberParams {
    orgUserId: number,
    orgInternalName:string,
    encounterNumber:string,
    facilityId:number,
    updates: {
        patientMrn?: string
        patientLastName?: string,
        patientFirstName?: string,
        patientMiddleName?: string,
        patientSsn?: string,
        patientDob?: string,
        patientZipCode?: string,
        admitDate?: string,
        admitTime?: string,
        dischargeDate?: string,
        dischargeTime?: string,
        purged?: boolean,
        purgedTime?: string,
        patientAddressLine1?: string,
        patientAddressLine2?: string,
        patientCity?: string,
        patientState?: string,
        patientCountryCode?: string,
        patientHomePhone?: string,
        patientWorkPhone?: string,
        patientMobilePhone?: string,
        patientHomeEmail?: string,
        patientWorkEmail?: string,
        patientDriversLicenseNum?: string,
        patientDriversLicenseState?: string,
        patientDriversLicenseExpDt?: string,
        patientOccupation?: string,
        patientPrimaryLanguage?: string,
        patientMaritalStatus?: string,
        patientReligion?: string,
        patientGenderCd?: string,
        patientRace?: string,
        patientEthnicGroup?: string,
        patientNationality?: string,
        patientDeceased?: boolean,
        patientDeceasedDt?: string,
        admitType?: string,
        patientClass?: string,
        patientType?: string,
        hospitalServiceCode?: string,
        accidentDate?: string,
        accidentCode?: string,
        accidentDescription?: string,
        accidentLocation?: string,
        accidentAutoStateCode?: string,
        accidentAutoStateName?: string,
        accidentJobRelated?: string,
        accidentDeath?: string,
        insuranceDocument?: object,
        diagnosisDocument?: object,
        relationsDocument?: object,
        guarantorDocument?: object,
        financialClass?: string,
        statusCode?: string
    }
}
export async function patchOrCreateEncounterByEncounterNumber(params:PatchOrCreateEncounterByEncounterNumberParams):Promise<boolean> {
    let {transaction, connection, models} = await <{transaction:Transaction, connection:Sequelize, models:any}>orgModels.createOrgUserTransaction(params.orgInternalName, params.orgUserId);

    // First we create an updates object to user for the update statement. We need 
    // to turn the JSON objects into strings.
    let updates:any = _.clone(params.updates);
    if(updates.insuranceDocument && _.isPlainObject(updates.insuranceDocument)) updates.insuranceDocument = JSON.stringify(updates.insuranceDocument);
    if(updates.diagnosisDocument && _.isPlainObject(updates.diagnosisDocument)) updates.diagnosisDocument = JSON.stringify(updates.diagnosisDocument);
    if(updates.relationsDocument && _.isPlainObject(updates.relationsDocument)) updates.relationsDocument = JSON.stringify(updates.relationsDocument);
    if(updates.guarantorDocument && _.isPlainObject(updates.guarantorDocument)) updates.guarantorDocument = JSON.stringify(updates.guarantorDocument);

    console.log('Sending updates:');

    // First we attempt to patch an existing encounter, if the encounter doesn't exist, this will
    // fail and then we will attempt to create a new encounter.
    let [updateRowsAffected, updateModel] = <[number, any]> await models.Encounter.update(
        updates, 
        <UpdateOptions>{ 
            where: {
                encounterNumber: params.encounterNumber,
                facilityId: params.facilityId
            },
            transaction: transaction
        }
    );
    console.log(JSON.stringify({updateRowsAffected,updateModel},null,4));

    if(updateRowsAffected == 0) {
        updates.facilityId = params.facilityId;
        updates.encounterNumber = params.encounterNumber;
        let [createRowsAffected, createModel] = <[number, any]> await models.Encounter.create(
            updates,
            <CreateOptions>{
                transaction: transaction,
                fields: _.keys(updates)
            }
        )
        console.log(JSON.stringify({createRowsAffected, createModel},null,4));
    }

    /*
    let query = `UPDATE enctr_form_surgery
                    SET qcdr_subm_enctr_form_ver = :qcdrSubmissionEncounterFormVersion,
                        qcdr_subm_case_id = :qcdrSubmissionCaseId
                WHERE enctr_form_id = :enctrFormId;`
    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            qcdrSubmissionEncounterFormVersion: update.submittedEncounterFormVersion,
            qcdrSubmissionCaseId: update.qcdrCaseId,
            enctrFormId: update.encounterFormId
        },
        transaction: transaction
    }
    */


    //let queryResult = await connection.query(query,options);
    await transaction.commit();
    return true;
}