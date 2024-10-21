import { Sequelize, QueryOptions, QueryTypes } from 'sequelize';
import * as moment from 'moment';
import * as _ from 'lodash';

import * as orgModels from '../model/OrgModels.js';
import { DataAnomaly } from '../model/DataAnomaly';

import { ModelPropertyUpdate } from '../model/model/ModelPropertyUpdate.js';
import { ModelPropertyUpdateService } from '../v2/services/ModelPropertyUpdateService.js';
import { getOrgConnectionByOrgInternalName } from '../v2/entity/orgConnections.js';

interface UpdateEncounterFormParams {
  orgInternalName: string;
  encounterFormId: number;
  modelPropertyUpdates: ModelPropertyUpdate[];
  skipAuditVersionUpdate: boolean;
}

export async function updateEncounterForm(params:UpdateEncounterFormParams):Promise<number> {
  //console.log('Creating model property update service.');
  let service = new ModelPropertyUpdateService();
  //console.log('Getting org connection.');
  let orgConnection = await getOrgConnectionByOrgInternalName(params.orgInternalName);
  //console.log('Updating model.');
  return service.updateModel(orgConnection, params.encounterFormId, params.modelPropertyUpdates, params.skipAuditVersionUpdate);
}


interface GetUpdatedEncounterFormsParams {
    orgInternalName:string,
    facilityId:number,
    from: Date,
    to: Date
}
interface UpdatedEncounterFormResult {
    facilityId: number,
    encounterFormId:number,
    formDefinitionName:string,
    encounterFormTagIds: number[] | null,
    encounterFormTagCategoriesAndNames: string[] | null,
    formDefinitionTitle: string,
    formCompletePercent: number,
    formIsVoided: boolean
}
/*
Note that for this function the from and to dates are calculated inclusive of the from and exclusive of the to.
Or in the query updateTime >= from and updateTime < to.
*/
export async function getUpdatedEncounterForms(params:GetUpdatedEncounterFormsParams):Promise<UpdatedEncounterFormResult[]> {
    let query = `WITH /* class@EncounterFormService.getUpdatedEncounterForms */
updatedForms AS (
   SELECT fd.fac_id,
          fd.form_defn_nm,
          fd.form_defn_title,
          ef.enctr_form_id,
          ef.form_cmplt_pct,
          ef.void_ind
     FROM enctr_form ef
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
    WHERE fd.fac_id = :facilityId
      AND ef.upd_dttm >= :fromTimestamp
      AND ef.upd_dttm < :toTimestamp
),
updateStrokes AS (
   SELECT fd.fac_id,
          fd.form_defn_nm,
          fd.form_defn_title,
          ef.enctr_form_id,
          ef.form_cmplt_pct,
          ef.void_ind
     FROM page_surgery_stroke pss
     JOIN page_surgery ps
       ON ps.page_id = pss.page_id
     JOIN enctr_form ef
       ON ef.enctr_form_id = ps.enctr_form_id
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
    WHERE fd.fac_id = :facilityId
      AND pss.ins_dttm >= :fromTimestamp
      AND pss.ins_dttm < :toTimestamp
),
allUpdates AS (
   SELECT fac_id,         
          form_defn_nm,   
          form_defn_title,
          enctr_form_id,  
          form_cmplt_pct, 
          void_ind        
     FROM updatedForms
    UNION
   SELECT fac_id,         
          form_defn_nm,   
          form_defn_title,
          enctr_form_id,  
          form_cmplt_pct, 
          void_ind        
     FROM updateStrokes
)
SELECT fac_id                      AS "facilityId",
       ef.enctr_form_id            AS "encounterFormId",
       form_defn_nm                AS "formDefinitionName",
       eft.tag_ids                 AS "encounterFormTagIds",
       eft.tag_catgs_nms           AS "encounterFormTagCategoriesAndNames",
       form_defn_title             AS "formDefinitionTitle",
       form_cmplt_pct              AS "formCompletePercent",
       void_ind                    AS "formIsVoided"
  FROM allUpdates ef
  LEFT JOIN (SELECT eft.enctr_form_id,
                    array_agg(eft.tag_id) AS tag_ids,
                    array_agg(t.catg_nm||'|'||t.tag_nm) AS tag_catgs_nms
               FROM enctr_form_tag eft
               JOIN tag t
                 ON t.tag_id = eft.tag_id
              GROUP BY eft.enctr_form_id) eft
    ON eft.enctr_form_id = ef.enctr_form_id`;

    let fromTimestamp = moment(params.from).toISOString();
    let toTimestamp = moment(params.to).toISOString();

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            fromTimestamp: fromTimestamp,
            toTimestamp: toTimestamp,
            facilityId: params.facilityId
        }
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <UpdatedEncounterFormResult>{
            facilityId: parseInt(r.facilityId),
            encounterFormId: parseInt(r.encounterFormId),
            encounterFormTagIds: r.encounterFormTagIds,
            formDefinitionName: r.formDefinitionName,
            encounterFormTagCategoriesAndNames: r.encounterFormTagCategoriesAndNames,
            formDefinitionTitle: r.formDefinitionTitle,
            formCompletePercent: r.formCompletePercent,
            formIsVoided: r.formIsVoided
        }
    });
    return results;
}

interface GetSubmittedAbgCasesParams {
    orgInternalName:string,
    from: Date,
    to: Date
}
interface GetSubmittedAbgCasesResult {
    facilityId: number,
    facilityName: string,
    providerNpi: string,
    providerLastName: string,
    providerFirstName: string,
    providerType: string,
    caseCount: number
}
export async function getSubmittedAbgCases(params:GetSubmittedAbgCasesParams):Promise<GetSubmittedAbgCasesResult[]> {
    let query = `
    WITH
    facilityProviders AS (
       SELECT f.fac_id,
              f.fac_nm,
              f.actv_ind AS fac_actv_ind,
              p.prvr_id,
              p.natl_prvr_id,
              UPPER(TRIM(p.last_nm)) last_nm,
              UPPER(TRIM(p.frst_nm)) frst_nm,
              p.prvr_typ,
              p.actv_ind AS prvr_actv_ind
         FROM fac f
         JOIN prvr p
           ON p.fac_id = f.fac_id
        WHERE f.test_fac_ind IS DISTINCT FROM TRUE   -- exclude test facilities
          AND p.prvr_typ IN ('MDA','CRNA')   -- only anesthesia providers
    ),
    casesSubmittedFor2018 AS (
       SELECT f.fac_id,
              efs.enctr_form_id
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
          AND efs.qcdr_subm_case_id IS NOT NULL
        WHERE f.test_fac_ind IS DISTINCT FROM TRUE   -- exclude test facilities
          AND efs.proc_dt BETWEEN :fromTimestamp AND :toTimestamp   -- only 2018 cases
    ),
    providersWith2018SubmittedCases AS (
       SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_id
         FROM (SELECT DISTINCT
                      anes_dtl.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      anes_prvr_id
                 FROM (SELECT cases.fac_id,
                              cases.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                         FROM casesSubmittedFor2018 cases
                         JOIN page_surgery ps
                           ON ps.enctr_form_id = cases.enctr_form_id
                         JOIN page_surgery_dtl psd
                           ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY cases.fac_id,
                                 cases.enctr_form_id,
                                 ps.page_id,
                                 ps.page_nm,
                                 ps.page_no,
                                 psd.prop_seq) anes_dtl
        WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
    ),
    anes_staff AS (
       SELECT fac_id,
              anes_prvr_id,
              COUNT(*) case_cnt
         FROM providersWith2018SubmittedCases
        WHERE anes_prvr_seq <= 6
        GROUP BY fac_id,
                 anes_prvr_id
    )
    SELECT f.fac_id               "facilityId",
           f.fac_nm               "facilityName",
           f.natl_prvr_id         "providerNpi",
           f.last_nm              "providerLastName",
           f.frst_nm              "providerFirstName",
           f.prvr_typ             "providerType",
           SUM(COALESCE(a.case_cnt,0)) "provider2018SubmittedCaseCount"
      FROM facilityProviders f
      LEFT JOIN anes_staff a
        ON a.fac_id = f.fac_id
       AND a.anes_prvr_id = f.prvr_id
     GROUP BY 1,2,3,4,5,6
     ORDER BY 2,4
    `;

    let fromTimestamp = moment(params.from).toISOString();
    let toTimestamp = moment(params.to).toISOString();

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            fromTimestamp: fromTimestamp,
            toTimestamp: toTimestamp
        }
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <GetSubmittedAbgCasesResult>{
            facilityId: parseInt(r.facilityId),
            facilityName: r.facilityName,
            providerNpi: r.providerNpi,
            providerLastName: r.providerLastName,
            providerFirstName: r.providerFirstName,
            providerType: r.providerType,
            caseCount: parseInt(r.provider2018SubmittedCaseCount)
        }
    });
    return results;
}

export async function getUnsubmittedAbgCases(params:GetSubmittedAbgCasesParams):Promise<GetSubmittedAbgCasesResult[]> {
  let query = `
  WITH
  facilityProviders AS (
     SELECT f.fac_id,
            f.fac_nm,
            f.actv_ind AS fac_actv_ind,
            p.prvr_id,
            p.natl_prvr_id,
            UPPER(TRIM(p.last_nm)) last_nm,
            UPPER(TRIM(p.frst_nm)) frst_nm,
            p.prvr_typ,
            p.actv_ind AS prvr_actv_ind
       FROM fac f
       JOIN prvr p
         ON p.fac_id = f.fac_id
      WHERE f.test_fac_ind IS DISTINCT FROM TRUE   -- exclude test facilities
        AND p.prvr_typ IN ('MDA','CRNA')   -- only anesthesia providers
  ),
  casesSubmittedFor2018 AS (
     SELECT f.fac_id,
            efs.enctr_form_id
       FROM fac f
       JOIN enctr e
         ON e.fac_id = f.fac_id
        AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
       JOIN enctr_form ef
         ON ef.enctr_id = e.enctr_id
        AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
       JOIN enctr_form_surgery efs
         ON efs.enctr_form_id = ef.enctr_form_id
      WHERE f.test_fac_ind IS DISTINCT FROM TRUE   -- exclude test facilities
        AND efs.proc_dt BETWEEN :fromTimestamp AND :toTimestamp   -- only 2018 cases
  ),
  providersWith2018SubmittedCases AS (
     SELECT fac_id,
            enctr_form_id,
            /* introduce a normalized sequence number to eliminate duplicates */
            ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
            anes_prvr_id
       FROM (SELECT DISTINCT
                    anes_dtl.fac_id,
                    enctr_form_id,
                    anes_prvr_seq,
                    anes_prvr_id
               FROM (SELECT cases.fac_id,
                            cases.enctr_form_id,
                            ps.page_id,
                            ps.page_nm,
                            ps.page_no,
                            psd.prop_seq AS anes_prvr_seq,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                       FROM casesSubmittedFor2018 cases
                       JOIN page_surgery ps
                         ON ps.enctr_form_id = cases.enctr_form_id
                       JOIN page_surgery_dtl psd
                         ON psd.page_id = ps.page_id
                      WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                      GROUP BY cases.fac_id,
                               cases.enctr_form_id,
                               ps.page_id,
                               ps.page_nm,
                               ps.page_no,
                               psd.prop_seq) anes_dtl
      WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
  ),
  anes_staff AS (
     SELECT fac_id,
            anes_prvr_id,
            COUNT(*) case_cnt
       FROM providersWith2018SubmittedCases
      WHERE anes_prvr_seq <= 6
      GROUP BY fac_id,
               anes_prvr_id
  )
  SELECT f.fac_id               "facilityId",
         f.fac_nm               "facilityName",
         f.natl_prvr_id         "providerNpi",
         f.last_nm              "providerLastName",
         f.frst_nm              "providerFirstName",
         f.prvr_typ             "providerType",
         SUM(COALESCE(a.case_cnt,0)) "provider2018SubmittedCaseCount"
    FROM facilityProviders f
    LEFT JOIN anes_staff a
      ON a.fac_id = f.fac_id
     AND a.anes_prvr_id = f.prvr_id
   GROUP BY 1,2,3,4,5,6
   ORDER BY 2,4
  `;

  let fromTimestamp = moment(params.from).toISOString();
  let toTimestamp = moment(params.to).toISOString();

  let options = <QueryOptions>{
      type: QueryTypes.RAW,
      replacements: {
          fromTimestamp: fromTimestamp,
          toTimestamp: toTimestamp
      }
  };

  let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
  let results = rows.map((r) => {
      return <GetSubmittedAbgCasesResult>{
          facilityId: parseInt(r.facilityId),
          facilityName: r.facilityName,
          providerNpi: r.providerNpi,
          providerLastName: r.providerLastName,
          providerFirstName: r.providerFirstName,
          providerType: r.providerType,
          caseCount: parseInt(r.provider2018SubmittedCaseCount)
      }
  });
  return results;
}


interface GetCompleteEncounterFormsWithoutTagsParams {
    orgInternalName:string,
    facilityId:number,
    excludedTags?: Array<{ tagName:string, tagCategory:string }>,
    excludedFormDefinitionNames?: string[],
    startDate: string,
}

interface GetCompleteEncounterFormsWithoutTagsResult {
    facilityId: number,
    encounterFormId: number,
    formDefinitionName: string,
    formCompletePercent: number,
    encounterNumber: string,
    dateOfService: string,
    orLocationCode: string,
    encounterFormTagCategoriesAndNames: string[]
}

/*
Note that for this function the from and to dates are calculated inclusive of the from and exclusive of the to.
Or in the query updateTime >= from and updateTime < to.
*/
export async function getCompleteEncounterFormsWithoutTags(params:GetCompleteEncounterFormsWithoutTagsParams):Promise<GetCompleteEncounterFormsWithoutTagsResult[]> {
    let {connection,models}:{connection:Sequelize, models:any} = await orgModels.getConnectionForOrg(params.orgInternalName);

    let tagCategoryNameArray = _.isArray(params.excludedTags) && params.excludedTags.length > 0 ?
                                    'ARRAY[' + params.excludedTags.map((tn) => connection.escape(tn.tagCategory + '|' + tn.tagName)) + ']' : 'NULL';
    let formNameArray = _.isArray(params.excludedFormDefinitionNames) && params.excludedFormDefinitionNames.length > 0 ?
                                    'ARRAY[' + params.excludedFormDefinitionNames.map((fdn) => connection.escape(fdn)) + ']' : 'NULL';

    let query = `
    SELECT /* class@EncounterFormService.getCompleteEncounterFormsWithoutTags */
        fd.fac_id                      AS "facilityId",
        ef.enctr_form_id               AS "encounterFormId",
        fd.form_defn_nm                AS "formDefinitionName",
        ef.form_cmplt_pct              AS "formCompletePercent",
        e.enctr_no                     AS "encounterNumber",
        efs.proc_dt                    AS "dateOfService",
        COALESCE(efs.locn_cd,'UNKNOWN')  AS "orLocationCode",
        eft.tag_catgs_nms              AS "encounterFormTagCategoriesAndNames"
    FROM enctr_form ef
    JOIN enctr e
    ON e.enctr_id = ef.enctr_id
    JOIN enctr_form_surgery efs
    ON efs.enctr_form_id = ef.enctr_form_id
    JOIN form_defn fd
    ON fd.form_defn_id = ef.form_defn_id
    AND fd.form_defn_typ <> 'discrete'  -- exclude discrete forms since they cannot be converted to PDF
    LEFT JOIN (SELECT eft.enctr_form_id,
                    array_agg(eft.tag_id) AS tag_ids,
                    array_agg(t.catg_nm||'|'||t.tag_nm) AS tag_catgs_nms
                FROM enctr_form_tag eft
                JOIN tag t
                ON t.tag_id = eft.tag_id
            GROUP BY eft.enctr_form_id) eft
    ON eft.enctr_form_id = ef.enctr_form_id
    WHERE fd.fac_id = :facilityId
    AND ef.form_cmplt_pct = 1  /* complete forms only */
    AND ef.void_ind = FALSE  -- exclude voided forms since they would never be sent anyway
    AND ef.upd_dttm >= :fromTimestamp  /* only send forms updated after a given timestamp in order to ignore history prior to the point of implementation */
    /* the following logic supports passing in an optional array of form definition names (formNameArray) to exclude */
    AND ((${formNameArray} IS NULL)
         OR
         (${formNameArray} IS NOT NULL AND
          (NOT fd.form_defn_nm = ANY(${formNameArray}))
         )
        )
    /* the following logic supports passing in an optional tagCategoryNameArray (NOTE: elements must be formatted as "category|name" ) */
    AND ((${tagCategoryNameArray} IS NULL)
         OR
         (${tagCategoryNameArray} IS NOT NULL AND
          (NOT COALESCE(eft.tag_catgs_nms,ARRAY[]::TEXT[]) && ${tagCategoryNameArray}) /* arrays do NOT overlap */
         )
        )`;

    //console.log('Timestamp prior to parsing: ' + params.startDate);
    let fromTimestampMoment = moment.utc(params.startDate);

    if(!fromTimestampMoment.isValid()) {
        throw new Error('Start date is not a valid date format.');
    }

    let fromTimestamp = fromTimestampMoment.toISOString();
    //console.log('Timestamp after parsing: ' + fromTimestamp);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            facilityId: params.facilityId,
            fromTimestamp: fromTimestamp
        }
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <GetCompleteEncounterFormsWithoutTagsResult>{
            facilityId: parseInt(r.facilityId),
            encounterFormId: parseInt(r.encounterFormId),
            encounterFormTagCategoriesAndNames: r.encounterFormTagCategoriesAndNames,
            formCompletePercent: parseFloat(r.formCompletePercent),
            formDefinitionName: r.formDefinitionName,
            encounterNumber: r.encounterNumber,
            dateOfService: r.dateOfService,
            orLocationCode: r.orLocationCode
        }
    });
    return results;
}

interface GetAbeoCaseLogParams {
  orgInternalName: string,
  facilityIds: number[]
}

interface GetAbeoCaseLogResult {
  data: Array<{
    facilityCode: string,
    encounterFormId: string,
    dateOfService: string,
    surgeonProvider: string,
    encounterNumber: string,
    patientMrn: string,
    patientName: string,
    patientDob: string,
    patientGender: string,
    anesCaseTypeCode: string,
    primaryAnesType: string,
    primaryProcedureDesc: string,
    orLocation: string,
    anesStartDate: string,
    anesStartTime: string,
    anesEndDate: string,
    anesEndTime: string,
    anesStaffList: string,
    formCreatedTimestamp: string,
    formCompletedTimestamp: string,
    formStatus: string,
    caseCancelledInd: string
  }>;
}

export async function getPrevious30DaysAbeoCaseLog(params:GetAbeoCaseLogParams):Promise<GetAbeoCaseLogResult> {

  let facilityIds =
  _.isArray(params.facilityIds) && params.facilityIds.length > 0
      ? params.facilityIds
      : 'NULL';

  let query = `WITH /* class@EncounterFormService.getUpdatedEncounterFormsAbeoCaseLog */
  cases AS (
     SELECT f.fac_id                                   AS fac_id,
            o.org_nm_intrnl || '_' || f.fac_nm_intrnl  AS fac_nm_intrnl,
            ef.enctr_form_id                           AS enctr_form_id,
            efs.proc_dt                                AS proc_dt,
            CONCAT_WS('^',TRIM(UPPER(surgn.last_nm)),
               TRIM(UPPER(surgn.frst_nm)),
               TRIM(UPPER(surgn.natl_prvr_id)))        AS surgn_prvr,
            e.enctr_no                                 AS enctr_no,
            e.pat_mrn                                  AS pat_mrn,
            CONCAT_WS('^',e.pat_last_nm,
               e.pat_frst_nm,
               e.pat_mid_nm)                           AS pat_nm,
            e.pat_dob                                  AS pat_dob,
            e.pat_gender_cd                            AS pat_gender_cd,
            efs.prim_anes_typ_cd                       AS prim_anes_typ_cd,
            efs.locn_cd                                AS locn_cd,
            efs.anes_case_typ_cd                       AS anes_case_typ_cd,
            efs.anes_st_dt                             AS anes_st_dt,
            efs.anes_st_tm                             AS anes_st_tm,
            efs.anes_end_dt                            AS anes_end_dt,
            efs.anes_end_tm                            AS anes_end_tm,
            CASE
               WHEN efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE THEN 'Y'
               ELSE 'N'
            END                                        AS case_cancelled_ind,
            ef.ins_dttm AT TIME ZONE 'US/Central'      AS form_create_dttm,
            CASE
               WHEN ef.form_cmplt_pct = 1 THEN 'COMPLETE'
               ELSE 'INCOMPLETE'
            END                                        AS form_status
       FROM enctr e
       JOIN fac f
         ON f.fac_id = e.fac_id
        AND f.fac_id IN (${facilityIds}) --should be only the fully electronic facilities we send to Abeo
       JOIN org o
         ON o.org_id = f.org_id
       JOIN enctr_form ef
         ON ef.enctr_id = e.enctr_id
        AND ef.void_ind = FALSE  -- only non-voided forms
        AND NOT EXISTS (SELECT 1
                          FROM enctr_form_tag eft
                          JOIN tag t
                            ON t.tag_id = eft.tag_id
                           AND eft.enctr_form_id = ef.enctr_form_id
                           AND t.catg_nm = 'Collector'
                           AND t.tag_nm = 'NoChargeData')  -- forms created by Collector that should not be sent electronically to Abeo
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND (-- forms explicitly tagged as "anesthesia cases"
             CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE OR
             -- forms explicitly tagged as "billable"
             CAST(fd.prop_map->'formIsBillable' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
            )
       JOIN enctr_form_surgery efs
         ON efs.enctr_form_id = ef.enctr_form_id
       LEFT JOIN prvr surgn
         ON surgn.fac_id = f.fac_id
        AND CAST(surgn.prvr_id AS VARCHAR) = efs.surgn_prvr_id
      WHERE ef.upd_dttm >= (CURRENT_DATE - ('30 DAYS'::INTERVAL))
  ),
  billingTags AS (
     SELECT c.enctr_form_id,
            eft.ins_dttm AT TIME ZONE 'US/Central' AS tag_dttm
       FROM enctr_form_tag eft
       JOIN cases c
         ON c.enctr_form_id = eft.enctr_form_id
       JOIN tag t
         ON t.tag_id = eft.tag_id
        AND t.catg_nm = 'Integration'
        AND t.tag_nm = 'AbeoBillingExtract'
  ),
  anesProviders AS (
     SELECT fac_id,
            enctr_form_id,
            /* introduce a normalized sequence number to eliminate duplicates */
            ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
            anes_prvr_nm
       FROM (SELECT DISTINCT
                    prvr.fac_id,
                    enctr_form_id,
                    anes_prvr_seq,
                    CONCAT_WS('^',UPPER(TRIM(prvr.last_nm)),UPPER(TRIM(prvr.frst_nm)),prvr.natl_prvr_id) AS anes_prvr_nm
               FROM (SELECT cases.fac_id,
                            cases.enctr_form_id,
                            ps.page_id,
                            ps.page_nm,
                            ps.page_no,
                            psd.prop_seq AS anes_prvr_seq,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                       FROM cases
                       JOIN page_surgery ps
                         ON ps.enctr_form_id = cases.enctr_form_id
                       JOIN page_surgery_dtl psd
                         ON psd.page_id = ps.page_id
                      WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                      GROUP BY cases.fac_id,
                               cases.enctr_form_id,
                               ps.page_id,
                               ps.page_nm,
                               ps.page_no,
                               psd.prop_seq) anesPrvrDetail
       JOIN prvr
         ON prvr.prvr_id = anesPrvrDetail.anes_prvr_id
        AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
  ),
  anesStaff AS (
     SELECT fac_id,
            enctr_form_id,
            ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_nm ORDER BY anes_prvr_seq),'~') anes_staff
       FROM anesProviders
      GROUP BY fac_id,
               enctr_form_id
  ),
  primaryProcedure AS (
     SELECT c.fac_id,
            c.enctr_form_id,
            MAX(CASE WHEN prop_nm = 'cpt_proc_sdesc' THEN prop_val ELSE '' END ORDER BY prop_seq) as primaryProcedureDesc
       FROM page_surgery_dtl psd
       JOIN page_surgery ps
         ON ps.page_id = psd.page_id
        AND psd.prop_seq = 1
        AND psd.prop_nm = 'cpt_proc_sdesc'
       JOIN cases c
         ON c.enctr_form_id = ps.enctr_form_id
      GROUP BY c.fac_id,
               c.enctr_form_id
  )
  SELECT c.fac_nm_intrnl        AS facilityCode,
         c.enctr_form_id        AS encounterFormId,
         c.proc_dt              AS dateOfService,
         c.surgn_prvr           AS surgeonProvider,
         c.enctr_no             AS encounterNumber,
         c.pat_mrn              AS patientMrn,
         c.pat_nm               AS patientName,
         c.pat_dob              AS patientDob,
         c.pat_gender_cd        AS patientGender,
         c.anes_case_typ_cd     AS anesCaseTypeCode,
         c.prim_anes_typ_cd     AS primaryAnesType,
         p.primaryProcedureDesc AS primaryProcedureDesc,
         c.locn_cd              AS orLocation,
         c.anes_st_dt           AS anesStartDate,
         c.anes_st_tm           AS anesStartTime,
         c.anes_end_dt          AS anesEndDate,
         c.anes_end_tm          AS anesEndTime,
         s.anes_staff           AS anesStaffList,
         c.form_create_dttm     AS formCreatedTimestamp,
         t.tag_dttm             AS formCompletedTimestamp,
         c.form_status          AS formStatus,
         c.case_cancelled_ind   AS caseCancelledInd
    FROM cases c
    LEFT JOIN billingTags t
      ON t.enctr_form_id = c.enctr_form_id
    LEFT JOIN anesStaff s
      ON s.fac_id = c.fac_id
     AND s.enctr_form_id = c.enctr_form_id
    LEFT JOIN primaryProcedure p
      ON p.fac_id = c.fac_id
     AND p.enctr_form_id = c.enctr_form_id;`;

  let options = <QueryOptions>{
    type: QueryTypes.RAW
  };

  try {
    let [rows, queryResult] = await orgModels.queryReadOnly( params.orgInternalName, query, options );

    let results = rows.map((r) => {
      let formattedResult = JSON.parse(JSON.stringify(r));
      if(formattedResult.formCreatedTimestamp) formattedResult.formCreatedTimestamp = moment(formattedResult.formCreatedTimestamp).format();
      if(formattedResult.formCompletedTimestamp) formattedResult.formCompletedTimestamp = moment(formattedResult.formCompletedTimestamp).format();
      return formattedResult;
    });
    return <GetAbeoCaseLogResult>{ data: results };
  }
  catch(error) {
    console.log(error);
  }
}

interface GetUpdatedEncounterFormSubstanceListParams {
    orgInternalName:string,
    facilityId:number,
    from: Date,
    to: Date
}
interface GetUpdatedEncounterFormSubstanceListResult {
    data: Array<{
        facilityCode: string,
        encounterNumber: string,
        patientMedicalRecordNumber: string,
        patientName: string,
        dateOfService: Date,
        orLocationcode: string,
        encounterFormId: number,
        formDefinitionTitle: string,
        caseCancelledIndicator: string,
        formCreatedTimestamp: string,
        formUpdatedTimestamp: string,
        formStatus: string,
        surgeonProvider: string,
        anesthesiaStaff: string,
        substanceName: string,
        substanceAmount: number,
        substanceUom: string,
        substanceAdminRoute: string
    }>;
}

/*
Note that for this function the from and to dates are calculated inclusive of the from and exclusive of the to.
Or in the query updateTime >= from and updateTime < to.
*/
export async function getUpdatedEncounterFormSubstanceList(params:GetUpdatedEncounterFormSubstanceListParams):Promise<GetUpdatedEncounterFormSubstanceListResult> {
    let query = `
    WITH /* class@EncounterFormService.getUpdatedEncounterFormSubstanceList */
    cases AS (
       SELECT f.fac_id,
              f.fac_nm,
              f.fac_nm_intrnl,
              e.enctr_no,
              e.pat_mrn,
              CONCAT_WS(' ',CONCAT_WS(', ',TRIM(UPPER(e.pat_last_nm)),TRIM(UPPER(e.pat_frst_nm))),TRIM(UPPER(e.pat_mid_nm))) AS pat_nm,
              efs.proc_dt,
              efs.locn_cd,
              ef.enctr_form_id,
              fd.form_defn_title,
              CASE
                 WHEN efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE THEN 'Y'
                 ELSE 'N'
              END AS case_cancelled_ind,
              ef.ins_dttm AT TIME ZONE 'US/Central'      AS form_create_dttm,
              ef.upd_dttm AT TIME ZONE 'US/Central'      AS form_update_dttm,
              CASE
                 WHEN ef.form_cmplt_pct = 1 THEN 'COMPLETE'
                 ELSE 'INCOMPLETE'
              END AS form_status,
              COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'UNKNOWN') AS surgn_prvr
         FROM enctr e
         JOIN fac f
           ON f.fac_id = e.fac_id
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind = FALSE  -- only non-voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
         LEFT JOIN prvr surgn
           ON surgn.fac_id = f.fac_id
          AND CAST(surgn.prvr_id AS VARCHAR) = efs.surgn_prvr_id
        WHERE f.fac_id = :facilityId
          AND ef.upd_dttm >= :fromTimestamp
          AND ef.upd_dttm < :toTimestamp
    ),
    anesProviders AS (
       SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_nm
         FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'UNKNOWN') AS anes_prvr_nm
                 FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                         FROM cases c
                         JOIN page_surgery ps
                           ON ps.enctr_form_id = c.enctr_form_id
                         JOIN page_surgery_dtl psd
                           ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                 c.enctr_form_id,
                                 ps.page_id,
                                 ps.page_nm,
                                 ps.page_no,
                                 psd.prop_seq) anesPrvrDetail
         JOIN prvr p
           ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_nm ORDER BY anes_prvr_seq),',') anes_staff
         FROM anesProviders
        GROUP BY fac_id,
                 enctr_form_id
    ),
    substances AS (
       SELECT c.fac_id,
              c.enctr_form_id,
              ps.page_id,
              prop_seq AS sbstnc_seq,
              MAX(CASE WHEN prop_nm = 'sbstnc_admin_dt' THEN prop_val ELSE NULL END) AS sbstnc_admin_dt,
              MAX(CASE WHEN prop_nm = 'sbstnc_admin_tm' THEN prop_val ELSE NULL END) AS sbstnc_admin_tm,
              MAX(CASE WHEN prop_nm = 'sbstnc_nm' THEN prop_val ELSE NULL END) AS sbstnc_nm,
              MAX(CASE WHEN prop_nm = 'sbstnc_amt' THEN prop_val ELSE NULL END) AS sbstnc_amt,
              MAX(CASE WHEN prop_nm = 'sbstnc_uom' THEN prop_val ELSE NULL END) AS sbstnc_uom,
              MAX(CASE WHEN prop_nm = 'sbstnc_admin_rte' THEN prop_val ELSE NULL END) AS sbstnc_admin_rte
         FROM page_surgery_dtl psd
         JOIN page_surgery ps
           ON ps.page_id = psd.page_id
         JOIN cases c
           ON c.enctr_form_id = ps.enctr_form_id
        WHERE prop_nm IN ('sbstnc_admin_dt','sbstnc_admin_tm','sbstnc_nm','sbstnc_amt','sbstnc_uom','sbstnc_admin_rte')
        GROUP BY c.fac_id,
                 c.enctr_form_id,
                 ps.page_id,
                 psd.prop_seq
    )
    SELECT c.fac_nm_intrnl AS "facilityCode",
           c.enctr_no AS "encounterNumber",
           c.pat_mrn AS "patientMedicalRecordNumber",
           c.pat_nm AS "patientName",
           c.proc_dt AS "dateOfService",
           c.locn_cd AS "orLocationcode",
           c.enctr_form_id AS "encounterFormId",
           c.form_defn_title AS "formDefinitionTitle",
           c.case_cancelled_ind AS "caseCancelledIndicator",
           c.form_create_dttm AS "formCreatedTimestamp",
           c.form_update_dttm AS "formUpdatedTimestamp",
           c.form_status AS "formStatus",
           c.surgn_prvr AS "surgeonProvider",
           a.anes_staff AS "anesthesiaStaff",
           s.sbstnc_nm AS "substanceName",
           s.sbstnc_amt AS "substanceAmount",
           s.sbstnc_uom AS "substanceUom",
           s.sbstnc_admin_rte AS "substanceAdminRoute"
      FROM cases c
      LEFT JOIN anesStaff a
        ON a.fac_id = c.fac_id
       AND a.enctr_form_id = c.enctr_form_id
      JOIN substances s
        ON s.fac_id = c.fac_id
       AND s.enctr_form_id = c.enctr_form_id
       AND (s.sbstnc_nm IS NOT NULL AND TRIM(s.sbstnc_nm) <> '')
       AND (s.sbstnc_amt IS NOT NULL AND TRIM(s.sbstnc_amt) <> '')
     ORDER BY c.fac_nm_intrnl, c.proc_dt, c.enctr_no, c.form_defn_title, c.form_create_dttm, c.form_update_dttm, s.sbstnc_nm;`;

    let fromTimestamp = moment(params.from).toISOString();
    let toTimestamp = moment(params.to).toISOString();

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            fromTimestamp: fromTimestamp,
            toTimestamp: toTimestamp,
            facilityId: params.facilityId
        }
    };

    try {
        let [rows, queryResult] = await orgModels.queryReadOnly( params.orgInternalName, query, options );

        let results = rows.map((r) => {
            let formattedResult = JSON.parse(JSON.stringify(r));
            if(formattedResult.formCreatedTimestamp) formattedResult.formCreatedTimestamp = moment(formattedResult.formCreatedTimestamp).format();
            if(formattedResult.formUpdatedTimestamp) formattedResult.formUpdatedTimestamp = moment(formattedResult.formUpdatedTimestamp).format();
            return formattedResult;
        });
        return <GetUpdatedEncounterFormSubstanceListResult>{ data: results };
    }
    catch(error) {
        console.log(error);
    }
}

interface GetUpdatedEncounterFormsGHStandardBillingParams {
    orgInternalName: string,
    facilityId: number,
    from: Date,
    to: Date,
    demographicsOnly?: boolean,
    useFacilityTimezone?: boolean,         // default to false (use US/Central)
    formSelectionMode?: string,            // "NewChanged", or "OnceOnly", default to "NewChanged"
    sendOnceTagCategory?: string,          // only applies if formSelectionMode === "OnceOnly"
    sendOnceTagName?: string,              // only applies if formSelectionMode === "OnceOnly"
    completeFormsOnly?: boolean,           // only applies if formSelectionMode === "OnceOnly", default to false
    minimumDateBoundary?: Date,            // only applies if formSelectionMode === "OnceOnly", default to '2021-01-01'
    preventFutureDateOfService?: boolean,  // only applies if formSelectionMode === "OnceOnly", default to true
    allowFormsToAgeDays?: number,          // only applies if formSelectionMode === "OnceOnly", default to 1 (send thru CURRENT_DATE-1)
    sendOnceIncludeUpdatedForms?: boolean  // only applies if formSelectionMode === "OnceOnly", default to false
}

interface GetUpdatedEncounterFormsGHStandardBillingResult {
    data: Array<{
        facilityId: number,
        facility: string,
        encounterNumber: string,
        patientMedicalRecordNumber: string,
        admit_dt: Date,
        admit_tm: string,
        disch_dt: Date,
        disch_tm: string,
        encounterFormId: number,
        formDefinitionTitle: string,
        formCreatedTimestamp: string,
        formUpdatedTimestamp: string,
        formStatus: string,
        patientName: string,
        patientAddress: string,
        patientHomePhone: string,
        patientWorkPhone: string,
        patientMobilePhone: string,
        patientHomeEmail: string,
        patientWorkEmail: string,
        patientSSN: string,
        patientDob: Date,
        patientSex: string,
        patientMaritalStatus: string,
        accident: string,
        guarantor: string,
        insurance: string,
        dateOfService: Date,
        anesthesiaCaseType: string,
        obCaseType: string,
        anesthesiaCareModel: string,
        caseCancelledIndicator: string,
        caseCancelledStage: string,
        cancellationReasons: string,
        orLocationcode: string,
        asaPhysicalStatus: string,
        patientType: string,
        primaryAnestheticType: string,
        surgeonStaff: string,
        anesthesiaStaff: string,
        surgeryStartDate: Date,
        surgeryStartTime: string,
        surgeryEndDate: Date,
        surgeryEndTime: string,
        anesthesiaStartDate: Date,
        anesthesiaStartTime: string,
        anesthesiaEndDate: Date,
        anesthesiaEndTime: string,
        epiduralStartDate: Date,
        epiduralStartTime: string,
        comborbidities: string,
        postopDiagnoses: string,
        surgicalProcedures: string,
        anesthesiaProcedures: string,
        asaProcedures: string,
        riskModifiers: string,
        adverseEvents: string,
        inOrDate: Date,
        inOrTime: string,
        procedureComments: string
    }>;
}

/*
Note that for this function the from and to dates are calculated inclusive of the from and exclusive of the to.
Or in the query updateTime >= from and updateTime < to.
*/
export async function getUpdatedEncounterFormsGHStandardBilling(params:GetUpdatedEncounterFormsGHStandardBillingParams):Promise<GetUpdatedEncounterFormsGHStandardBillingResult> {
    let query = `
    WITH /* class@EncounterFormService.getUpdatedEncounterFormsGHStandardBilling */
    demog AS (
       SELECT f.fac_id,
              f.fac_nm,
              f.fac_nm_intrnl,
              e.enctr_no,
              e.pat_mrn,
              COALESCE(TRIM(UPPER(e.pat_last_nm)),'')        AS enctr_pat_last_nm,
              COALESCE(TRIM(UPPER(e.pat_frst_nm)),'')        AS enctr_pat_frst_nm,
              COALESCE(TRIM(UPPER(e.pat_mid_nm)),'')         AS enctr_pat_mid_nm,
              COALESCE(e.pat_addr_ln_1,'')                   AS enctr_pat_addr_ln_1,
              COALESCE(e.pat_addr_ln_2,'')                   AS enctr_pat_addr_ln_2,
              COALESCE(e.pat_city,'')                        AS enctr_pat_city,
              COALESCE(e.pat_state_cd,'')                    AS enctr_pat_state_cd,
              COALESCE(e.pat_zip_cd,'')                      AS enctr_pat_zip_cd,
              COALESCE(e.pat_ph_no_home,'')                  AS enctr_pat_ph_no_home,
              COALESCE(e.pat_ph_no_bus,'')                   AS enctr_pat_ph_no_bus,
              COALESCE(e.pat_ph_no_mob,'')                   AS enctr_pat_ph_no_mob,
              COALESCE(e.pat_email_home,'')                  AS enctr_pat_email_home,
              COALESCE(e.pat_email_bus,'')                   AS enctr_pat_email_bus,
              COALESCE(e.pat_ssn,'')                         AS enctr_pat_ssn,
              e.pat_dob                                      AS enctr_pat_dob,
              COALESCE(e.pat_gender_cd,'')                   AS pat_gender_cd,
              COALESCE(e.pat_marital_status,'')              AS enctr_pat_marital_status,
              e.acc_dt,
              COALESCE(e.acc_cd,'')                          AS acc_cd,
              COALESCE(e.acc_desc,'')                        AS acc_desc,
              COALESCE(e.acc_locn,'')                        AS acc_locn,
              COALESCE(e.acc_auto_st_cd,'')                  AS acc_auto_st_cd,
              COALESCE(e.acc_auto_st_nm,'')                  AS acc_auto_st_nm,
              COALESCE(e.acc_job_rel_ind,'')                 AS acc_job_rel_ind,
              COALESCE(e.acc_death_ind,'')                   AS acc_death_ind,
              e.enctr_guarantor_doc,
              e.enctr_insurance_doc,
              e.admit_dt,
              e.admit_tm,
              e.disch_dt,
              e.disch_tm,
              NULL::BIGINT AS enctr_form_id,
              ''   AS form_defn_title,
              NULL AS form_create_dttm,
              NULL AS form_update_dttm,
              ''   AS form_status,
              NULL AS proc_dt,
              ''   AS anes_case_typ_cd,
              ''   AS ob_case_typ_cd,
              ''   AS anes_care_model_cd,
              ''   AS case_cancelled_ind,
              ''   AS case_cancelled_stg_cd,
              ''   AS locn_cd,
              ''   AS asa_clsfn_cd,
              NULL::BOOLEAN AS asa_emerg_ind,
              ''   AS pat_typ_cd,
              ''   AS prim_anes_typ_cd,
              ''   AS surgn_prvr_last_nm,
              ''   AS surgn_prvr_frst_nm,
              ''   AS surgn_prvr_natl_prvr_id,
              ''   AS surgn_prvr_cd,
              NULL AS surg_st_dt,
              NULL AS surg_st_tm,
              NULL AS surg_end_dt,
              NULL AS surg_end_tm,
              NULL AS anes_st_dt,
              NULL AS anes_st_tm,
              NULL AS anes_end_dt,
              NULL AS anes_end_tm,
              NULL AS epidural_st_dt,
              NULL AS epidural_st_tm,
              NULL AS in_or_dt,
              NULL AS in_or_tm,
              ''   AS risk_hypothermia_ind,
              ''   AS risk_hypotension_ind,
              ''   AS risk_field_avoidance_ind,
              ''   AS proc_cmmt_txt
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
        WHERE f.fac_id = :facilityId`;

        if(params.useFacilityTimezone === true) {
            query += `
          /* use facilty timezone */
          AND e.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') >= :fromTimestamp
          AND e.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') < :toTimestamp
            `;
        } else { // use US/Central timezone
            query += `
          /* use default US/Central timezone */
          AND e.upd_dttm AT TIME ZONE 'US/Central' >= :fromTimestamp
          AND e.upd_dttm AT TIME ZONE 'US/Central' < :toTimestamp
            `;
        }

        query += `
    ),
    cases AS (
       SELECT f.fac_id,
              f.fac_nm,
              f.fac_nm_intrnl,
              e.enctr_no,
              COALESCE(TRIM(e.pat_mrn),TRIM(efs.pat_mrn))    AS pat_mrn,
              COALESCE(TRIM(UPPER(e.pat_last_nm)),
                       TRIM(UPPER(efs.pat_last_nm)),'')      AS enctr_pat_last_nm,
              COALESCE(TRIM(UPPER(e.pat_frst_nm)),
                       TRIM(UPPER(efs.pat_frst_nm)),'')      AS enctr_pat_frst_nm,
              COALESCE(TRIM(UPPER(e.pat_mid_nm)),
                       TRIM(UPPER(efs.pat_mid_nm)),'')       AS enctr_pat_mid_nm,
              COALESCE(e.pat_addr_ln_1,'')                   AS enctr_pat_addr_ln_1,
              COALESCE(e.pat_addr_ln_2,'')                   AS enctr_pat_addr_ln_2,
              COALESCE(e.pat_city,'')                        AS enctr_pat_city,
              COALESCE(e.pat_state_cd,'')                    AS enctr_pat_state_cd,
              COALESCE(e.pat_zip_cd,'')                      AS enctr_pat_zip_cd,
              COALESCE(e.pat_ph_no_home,'')                  AS enctr_pat_ph_no_home,
              COALESCE(e.pat_ph_no_bus,'')                   AS enctr_pat_ph_no_bus,
              COALESCE(e.pat_ph_no_mob,'')                   AS enctr_pat_ph_no_mob,
              COALESCE(e.pat_email_home,'')                  AS enctr_pat_email_home,
              COALESCE(e.pat_email_bus,'')                   AS enctr_pat_email_bus,
              COALESCE(TRIM(e.pat_ssn),TRIM(efs.pat_ssn),'') AS enctr_pat_ssn,
              COALESCE(e.pat_dob,efs.pat_dob)                AS enctr_pat_dob,
              COALESCE(efs.pat_gender_cd,e.pat_gender_cd,'') AS pat_gender_cd,
              COALESCE(e.pat_marital_status,'')              AS enctr_pat_marital_status,
              e.acc_dt,
              COALESCE(e.acc_cd,'')                          AS acc_cd,
              COALESCE(e.acc_desc,'')                        AS acc_desc,
              COALESCE(e.acc_locn,'')                        AS acc_locn,
              COALESCE(e.acc_auto_st_cd,'')                  AS acc_auto_st_cd,
              COALESCE(e.acc_auto_st_nm,'')                  AS acc_auto_st_nm,
              COALESCE(e.acc_job_rel_ind,'')                 AS acc_job_rel_ind,
              COALESCE(e.acc_death_ind,'')                   AS acc_death_ind,
              e.enctr_guarantor_doc,
              e.enctr_insurance_doc,
              e.admit_dt,
              e.admit_tm,
              e.disch_dt,
              e.disch_tm,
              ef.enctr_form_id,
              fd.form_defn_title,
              ef.ins_dttm AT TIME ZONE 'US/Central' AS form_create_dttm,
              ef.upd_dttm AT TIME ZONE 'US/Central' AS form_update_dttm,
              CASE
                 WHEN ef.void_ind IS NOT DISTINCT FROM TRUE THEN 'VOIDED'
                 WHEN ef.form_cmplt_pct = 1 THEN 'COMPLETE'
                 ELSE 'INCOMPLETE'
              END AS form_status,
              efs.proc_dt,
              COALESCE(efs.anes_case_typ_cd,'')              AS anes_case_typ_cd,
              COALESCE(efs.ob_case_typ_cd,'')                AS ob_case_typ_cd,
              COALESCE(efs.anes_care_model_cd,'')            AS anes_care_model_cd,
              CASE
                 WHEN efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE THEN 'Y'
                 ELSE 'N'
              END AS case_cancelled_ind,
              COALESCE(efs.case_cancelled_stg_cd,'')         AS case_cancelled_stg_cd,
              COALESCE(efs.locn_cd,'')                       AS locn_cd,
              COALESCE(efs.asa_clsfn_cd,'')                  AS asa_clsfn_cd,
              efs.asa_emerg_ind,
              COALESCE(efs.pat_typ_cd,'')                    AS pat_typ_cd,
              COALESCE(efs.prim_anes_typ_cd,'')              AS prim_anes_typ_cd,
              COALESCE(surgn.last_nm,'')                     AS surgn_prvr_last_nm,
              COALESCE(surgn.frst_nm,'')                     AS surgn_prvr_frst_nm,
              COALESCE(surgn.natl_prvr_id,'')                AS surgn_prvr_natl_prvr_id,
              COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'') AS surgn_prvr_cd,
              efs.surg_st_dt,
              efs.surg_st_tm,
              efs.surg_end_dt,
              efs.surg_end_tm,
              efs.anes_st_dt,
              efs.anes_st_tm,
              efs.anes_end_dt,
              efs.anes_end_tm,
              efs.epidural_st_dt,
              efs.epidural_st_tm,
              efs.in_or_dt,
              efs.in_or_tm,
              CASE WHEN efs.risk_hypothermia_ind IS NOT DISTINCT FROM TRUE THEN 'Y' ELSE 'N' END AS risk_hypothermia_ind,
              CASE WHEN efs.risk_hypotension_ind IS NOT DISTINCT FROM TRUE THEN 'Y' ELSE 'N' END AS risk_hypotension_ind,
              CASE WHEN efs.risk_field_avoidance_ind IS NOT DISTINCT FROM TRUE THEN 'Y' ELSE 'N' END AS risk_field_avoidance_ind,
              COALESCE(proc_cmmt_txt,'')                     AS proc_cmmt_txt
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind = FALSE  -- only non-voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
              /* forms explicitly tagged as "anesthesia cases" or "billable" */
          AND (CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE OR
               CAST(fd.prop_map->'formIsBillable' AS BOOLEAN) IS NOT DISTINCT FROM TRUE)
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
          AND efs.proc_dt IS NOT NULL  -- added 4/1/2021 to filter out non-billiable activity like pre-assessment testing activity prior to the date of service`;

        if(params.formSelectionMode === "OnceOnly") {
            if(params.sendOnceIncludeUpdatedForms !== true) {
            // apply mandatory tag filter (but only if tagged and updated forms are unwanted)
                query += `
          /* forms not already tagged */
          AND NOT EXISTS (SELECT 1
                            FROM enctr_form_tag eft
                            JOIN tag t
                              ON t.tag_id = eft.tag_id
                             AND eft.enctr_form_id = ef.enctr_form_id
                             AND t.catg_nm = :sendOnceTagCategory
                             AND t.tag_nm = :sendOnceTagName)
                `;
            } else {
                query += `
          AND (/* forms not already tagged */
               (NOT EXISTS (SELECT 1
                              FROM enctr_form_tag eft
                              JOIN tag t
                                ON t.tag_id = eft.tag_id
                               AND eft.enctr_form_id = ef.enctr_form_id
                               AND t.catg_nm = :sendOnceTagCategory
                               AND t.tag_nm = :sendOnceTagName))
               OR
               /* forms has been updated (i.e. send corrected version) */`;
                if(params.useFacilityTimezone === true) {
                    query += `
                 (/* use facilty timezone */
                  ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') >= :fromTimestamp AND
                  ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') < :toTimestamp)
                             `;
                } else { // use US/Central timezone
                    query += `
                  (/* use default US/Central timezone */
                   ef.upd_dttm AT TIME ZONE 'US/Central' >= :fromTimestamp AND
                   ef.upd_dttm AT TIME ZONE 'US/Central' < :toTimestamp)
                   `;
                }
                query += `
              )
                `;
            }

            if(params.completeFormsOnly === true) {
                query += `
          /* completeFormsOnly === true */
          AND (ef.form_cmplt_pct = 1 OR                           -- Either 100% complete forms, or
               efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE)  -- same day cancellations
                `;
            }

            if(typeof params.minimumDateBoundary != 'undefined' && params.minimumDateBoundary) {
                query += `
          /* use minimumDateBoundary */
          AND efs.proc_dt >= (:minimumDateBoundary)::DATE
                `;
            }

            if(params.preventFutureDateOfService === true) {
                query += `
          /* preventFutureDateOfService === true */
          AND efs.proc_dt < (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE
                `;
            }

            if(typeof params.allowFormsToAgeDays != 'undefined' && params.allowFormsToAgeDays) {
                // send forms up through current system date - allowFormsToAgeDays)
                query += `
          /* use allowFormsToAgeDays */
          AND efs.proc_dt <= ((CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE - ((COALESCE(:allowFormsToAgeDays,1)::TEXT||' DAY')::INTERVAL))::DATE
                `;
            } else { // default to 1 day (send forms up through current system date - 1 day) - NOTE that this will result in an equivalent criterion to params.preventFutureDateOfService === true
                query += `
          /* default allowFormsToAgeDays to 1 day */
          AND efs.proc_dt <= ((CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE - (('1 DAY')::INTERVAL))::DATE
                `;
            }
        }

        query += `
         LEFT JOIN prvr surgn
           ON surgn.fac_id = f.fac_id
          AND CAST(surgn.prvr_id AS VARCHAR) = efs.surgn_prvr_id
        WHERE f.fac_id = :facilityId
          AND efs.proc_dt IS NOT NULL  -- added 4/1/2021 to filter out non-billiable activity like pre-assessment testing activity prior to the date of service`;

        if(!params.formSelectionMode || params.formSelectionMode === "NewChanged") {
            if(params.useFacilityTimezone === true) {
                query += `
          /* use facilty timezone */
          AND ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') >= :fromTimestamp
          AND ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(f.fac_id,'facTimeZone'),'US/Central') < :toTimestamp
                `;
            } else { // use US/Central timezone
                query += `
          /* use default US/Central timezone */
          AND ef.upd_dttm AT TIME ZONE 'US/Central' >= :fromTimestamp
          AND ef.upd_dttm AT TIME ZONE 'US/Central' < :toTimestamp
               `;
            }
        }

        query += `
    ),
    cancellationReasonsRaw AS (
        WITH reasons AS (
            SELECT c.fac_id,
                   ps.enctr_form_id,
                   ps.page_id,
                   prop_seq,
                   MAX(CASE WHEN prop_nm = 'cancel_reason' THEN prop_val::VARCHAR ELSE NULL END) AS cancel_reason,
                   MAX(CASE WHEN prop_nm = 'cancel_reason_ind' THEN CAST(prop_val AS BOOLEAN)::INTEGER ELSE NULL END) AS cancel_reason_ind
              FROM cases c
              JOIN page_surgery ps
                ON ps.enctr_form_id = c.enctr_form_id
              JOIN page_surgery_dtl psd
                ON psd.page_id = ps.page_id
             WHERE psd.prop_nm IN ('cancel_reason','cancel_reason_ind')
               AND psd.prop_val IS NOT NULL
             GROUP BY c.fac_id,
                      ps.enctr_form_id,
                      ps.page_id,
                      prop_seq)
        SELECT fac_id,
               r.enctr_form_id,
               COALESCE(rcrvsl.cancel_reason_desc,'UNKNOWN') AS cancel_reason_description
          FROM reasons r
          LEFT JOIN rpt_cancel_reasons_val_set_list_v rcrvsl
            ON rcrvsl.cancel_reason_nm = r.cancel_reason
         WHERE r.cancel_reason_ind = 1
    ),
    cancellationReasonsFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(cancel_reason_description),'~') cancellation_reasons
         FROM cancellationReasonsRaw
        WHERE cancel_reason_description IS NOT NULL
        GROUP BY fac_id,
                 enctr_form_id
    ),
    anesProvidersRaw AS (
       SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_last_nm,
              anes_prvr_frst_nm,
              anes_prvr_natl_prvr_id,
              anes_prvr_cd,
              anes_prvr_typ,
              anes_prvr_st_dt,
              anes_prvr_st_tm,
              anes_prvr_end_dt,
              anes_prvr_end_tm
         FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      COALESCE(p.last_nm,'')        AS anes_prvr_last_nm,
                      COALESCE(p.frst_nm,'')        AS anes_prvr_frst_nm,
                      COALESCE(p.natl_prvr_id,'')   AS anes_prvr_natl_prvr_id,
                      COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'') AS anes_prvr_cd,
                      COALESCE(p.prvr_typ,'')       AS anes_prvr_typ,
                      COALESCE(anes_prvr_st_dt,'')  AS anes_prvr_st_dt,
                      COALESCE(anes_prvr_st_tm,'')  AS anes_prvr_st_tm,
                      COALESCE(anes_prvr_end_dt,'') AS anes_prvr_end_dt,
                      COALESCE(anes_prvr_end_tm,'') AS anes_prvr_end_tm
                 FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_prvr_id'::TEXT THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_prvr_dt_asmd_care'::TEXT THEN psd.prop_val ELSE NULL END) AS anes_prvr_st_dt,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_prvr_tm_asmd_care'::TEXT THEN psd.prop_val ELSE NULL END) AS anes_prvr_st_tm,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_prvr_dt_end_care'::TEXT THEN psd.prop_val ELSE NULL END) AS anes_prvr_end_dt,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_prvr_tm_end_care'::TEXT THEN psd.prop_val ELSE NULL END) AS anes_prvr_end_tm
                         FROM cases c
                         JOIN page_surgery ps
                           ON ps.enctr_form_id = c.enctr_form_id
                         JOIN page_surgery_dtl psd
                           ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id,anes_prvr_dt_asmd_care,anes_prvr_tm_asmd_care,anes_prvr_dt_end_care,anes_prvr_tm_end_care}'::text[]))
                        GROUP BY c.fac_id,
                                 c.enctr_form_id,
                                 ps.page_id,
                                 ps.page_nm,
                                 ps.page_no,
                                 psd.prop_seq) anesPrvrDetail
         JOIN prvr p
           ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesProvidersFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',anes_prvr_last_nm,anes_prvr_frst_nm,anes_prvr_natl_prvr_id,anes_prvr_cd,anes_prvr_typ,anes_prvr_st_dt,anes_prvr_st_tm,anes_prvr_end_dt,anes_prvr_end_tm)),'~') anes_providers
         FROM anesProvidersRaw
        GROUP BY fac_id,
                 enctr_form_id
        ORDER BY fac_id,
                 enctr_form_id
    ),
    complicationsRaw AS (
       WITH comps AS (
          SELECT c.fac_id,
                 ps.enctr_form_id,
                 ps.page_id,
                 prop_seq,
                 MAX(CASE WHEN prop_nm = 'comp_nm' THEN prop_val::TEXT ELSE NULL END) AS comp_nm,
                 MAX(CASE WHEN prop_nm = 'comp_ind' THEN CAST(prop_val AS BOOLEAN)::INTEGER ELSE NULL END) AS comp_ind
            FROM cases c
            JOIN page_surgery ps
              ON ps.enctr_form_id = c.enctr_form_id
            JOIN page_surgery_dtl psd
              ON psd.page_id = ps.page_id
           WHERE prop_nm IN ('comp_nm','comp_ind')
             AND prop_val IS NOT NULL
           GROUP BY c.fac_id,
                    ps.enctr_form_id,
                    ps.page_id,
                    prop_seq)
       SELECT fac_id,
              c.enctr_form_id,
              COALESCE(rcvsl.comp_desc,'') AS comp_description
         FROM comps c
         LEFT JOIN rpt_complications_val_set_list_v rcvsl
           ON rcvsl.comp_nm = c.comp_nm
        WHERE c.comp_ind = 1
    ),
    complicationsFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(comp_description),'~') comp_descriptions
         FROM complicationsRaw
        WHERE comp_description IS NOT NULL
        GROUP BY fac_id,
                 enctr_form_id
    ),
    diagnosesRaw AS (
        SELECT c.fac_id,
               ps.enctr_form_id,
               MAX(CASE WHEN prop_nm = 'icd_diag_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) icd_diag_cd,
               MAX(CASE WHEN prop_nm = 'diag_text' THEN prop_val ELSE '' END ORDER BY prop_seq) diag_text,
               ROW_NUMBER () OVER (PARTITION BY ps.enctr_form_id ORDER BY ps.enctr_form_id, psd.prop_seq) AS diag_seq
          FROM cases c
          JOIN page_surgery ps
            ON ps.enctr_form_id = c.enctr_form_id
          JOIN page_surgery_dtl psd
            ON psd.page_id = ps.page_id
           AND psd.prop_nm IN ('diag_text','icd_diag_cd')
         GROUP BY c.fac_id,
                  ps.enctr_form_id,
                  psd.prop_seq
    ),
    diagnosesFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',icd_diag_cd,diag_text)),'~') diagnoses
         FROM diagnosesRaw
        WHERE NOT (icd_diag_cd = '' AND diag_text = '')
        GROUP BY fac_id,
                 enctr_form_id
    ),
    comborbiditiesRaw AS (
       SELECT c.fac_id,
              ps.enctr_form_id,
              MAX(CASE WHEN prop_nm = 'icd_cm_diag_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) icd_cm_diag_cd,
              MAX(CASE WHEN prop_nm = 'icd_cm_diag_sdesc' THEN prop_val ELSE '' END ORDER BY prop_seq) icd_cm_diag_desc,
              ROW_NUMBER () OVER (PARTITION BY ps.enctr_form_id ORDER BY ps.enctr_form_id, psd.prop_seq) AS icd_cm_diag_seq
         FROM cases c
         JOIN page_surgery ps
           ON ps.enctr_form_id = c.enctr_form_id
         JOIN page_surgery_dtl psd
           ON psd.page_id = ps.page_id
          AND psd.prop_nm IN ('icd_cm_diag_cd','icd_cm_diag_sdesc')
        GROUP BY c.fac_id,
                 ps.enctr_form_id,
                 psd.prop_seq
    ),
    comborbiditiesFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',icd_cm_diag_cd,icd_cm_diag_desc)),'~') comborbidities
         FROM comborbiditiesRaw
        WHERE NOT (icd_cm_diag_cd = '' AND icd_cm_diag_desc = '')
        GROUP BY fac_id,
                 enctr_form_id
    ),
    surgicalProceduresRaw AS (
       SELECT c.fac_id,
              ps.enctr_form_id,
              MAX(CASE WHEN prop_nm = 'cpt_proc_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) cpt_proc_cd,
              MAX(CASE WHEN prop_nm = 'cpt_proc_sdesc' THEN prop_val ELSE '' END ORDER BY prop_seq) cpt_proc_desc,
              MAX(CASE WHEN prop_nm = 'cpt_proc_mod_1' THEN prop_val ELSE '' END ORDER BY prop_seq) cpt_proc_mod,
              ROW_NUMBER () OVER (PARTITION BY ps.enctr_form_id ORDER BY ps.enctr_form_id, psd.prop_seq) AS cpt_proc_seq
         FROM cases c
         JOIN page_surgery ps
           ON ps.enctr_form_id = c.enctr_form_id
         JOIN page_surgery_dtl psd
           ON psd.page_id = ps.page_id
          AND psd.prop_nm IN ('cpt_proc_cd','cpt_proc_sdesc','cpt_proc_mod_1')
        GROUP BY c.fac_id,
                 ps.enctr_form_id,
                 psd.prop_seq
    ),
    surgicalProceduresFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',cpt_proc_cd,cpt_proc_desc,cpt_proc_mod)),'~') surgical_procedures
         FROM surgicalProceduresRaw
        WHERE NOT (cpt_proc_cd = '' AND cpt_proc_desc = '' AND cpt_proc_mod = '')
        GROUP BY fac_id,
                 enctr_form_id
    ),
    anesthesiaProceduresRaw AS (
       SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_proc_seq NULLS LAST) AS anes_proc_seq,
              anes_proc_cd,
              anes_proc_desc,
              anes_proc_mod,
              anes_proc_mod_desc,
              anes_proc_prvr_last_nm,
              anes_proc_prvr_frst_nm,
              anes_proc_prvr_natl_prvr_id,
              anes_proc_prvr_cd,
              anes_proc_prvr_typ,
              anes_proc_prvr_st_dt,
              anes_proc_prvr_st_tm,
              anes_proc_prvr_end_dt,
              anes_proc_prvr_end_tm
         FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_proc_seq,
                      anes_proc_cd,
                      anes_proc_desc,
                      anes_proc_mod,
                      anes_proc_mod_desc,
                      COALESCE(p.last_nm,'')        AS anes_proc_prvr_last_nm,
                      COALESCE(p.frst_nm,'')        AS anes_proc_prvr_frst_nm,
                      COALESCE(p.natl_prvr_id,'')   AS anes_proc_prvr_natl_prvr_id,
                      COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'') AS anes_proc_prvr_cd,
                      COALESCE(p.prvr_typ,'')       AS anes_proc_prvr_typ,
                      anes_proc_prvr_st_dt,
                      anes_proc_prvr_st_tm,
                      anes_proc_prvr_end_dt,
                      anes_proc_prvr_end_tm
                 FROM (SELECT c.fac_id,
                              ps.enctr_form_id,
                              MAX(CASE WHEN prop_nm = 'anes_proc_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) anes_proc_cd,
                              MAX(CASE WHEN prop_nm = 'anes_proc_sdesc' THEN prop_val ELSE '' END ORDER BY prop_seq) anes_proc_desc,
                              MAX(CASE WHEN prop_nm = 'anes_proc_mod_cd_1' THEN prop_val ELSE '' END ORDER BY prop_seq) anes_proc_mod,
                              MAX(CASE WHEN prop_nm = 'anes_proc_mod_sdesc_1' THEN prop_val ELSE '' END ORDER BY prop_seq) anes_proc_mod_desc,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_proc_prvr_id'::TEXT THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_proc_prvr_id,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_proc_prvr_st_dt'::TEXT THEN psd.prop_val ELSE '' END) AS anes_proc_prvr_st_dt,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_proc_prvr_st_tm'::TEXT THEN psd.prop_val ELSE '' END) AS anes_proc_prvr_st_tm,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_proc_prvr_end_dt'::TEXT THEN psd.prop_val ELSE '' END) AS anes_proc_prvr_end_dt,
                              MAX(CASE WHEN psd.prop_nm::TEXT = 'anes_proc_prvr_end_tm'::TEXT THEN psd.prop_val ELSE '' END) AS anes_proc_prvr_end_tm,
                              ROW_NUMBER () OVER (PARTITION BY ps.enctr_form_id ORDER BY ps.enctr_form_id, ps.page_id, psd.prop_seq) AS anes_proc_seq
                         FROM cases c
                         JOIN page_surgery ps
                           ON ps.enctr_form_id = c.enctr_form_id
                         JOIN page_surgery_dtl psd
                           ON psd.page_id = ps.page_id
                          AND psd.prop_nm IN ('anes_proc_cd','anes_proc_sdesc','anes_proc_mod_cd_1','anes_proc_mod_sdesc_1','anes_proc_prvr_id','anes_proc_prvr_st_dt','anes_proc_prvr_st_tm','anes_proc_prvr_end_dt','anes_proc_prvr_end_tm')
                        GROUP BY c.fac_id,
                                 ps.enctr_form_id,
                                 ps.page_id,
                                 psd.prop_seq) anesProcDetail
                 LEFT JOIN prvr p
                   ON p.prvr_id = anesProcDetail.anes_proc_prvr_id) anesProcs
    ),
    anesthesiaProceduresFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',anes_proc_cd,anes_proc_desc,anes_proc_mod,anes_proc_mod_desc,anes_proc_prvr_last_nm,anes_proc_prvr_frst_nm,anes_proc_prvr_natl_prvr_id,anes_proc_prvr_cd,anes_proc_prvr_typ,anes_proc_prvr_st_dt,anes_proc_prvr_st_tm,anes_proc_prvr_end_dt,anes_proc_prvr_end_tm)),'~') anesthesia_procedures
         FROM anesthesiaProceduresRaw
        WHERE NOT (anes_proc_cd = '' AND anes_proc_desc = '' AND anes_proc_mod = '' AND
               anes_proc_mod_desc = '' AND anes_proc_prvr_last_nm = '' AND anes_proc_prvr_frst_nm = '' AND
               anes_proc_prvr_natl_prvr_id = '' AND anes_proc_prvr_cd = '' AND anes_proc_prvr_typ = '' AND
               anes_proc_prvr_st_dt = '' AND anes_proc_prvr_st_tm = '' AND anes_proc_prvr_end_dt = '' AND
               anes_proc_prvr_end_tm = '')
        GROUP BY fac_id,
                 enctr_form_id
    ),
    asaProceduresRaw AS (
       SELECT c.fac_id,
              ps.enctr_form_id,
              MAX(CASE WHEN prop_nm = 'asa_proc_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) asa_proc_cd,
              MAX(CASE WHEN prop_nm = 'asa_proc_sdesc' THEN prop_val ELSE '' END ORDER BY prop_seq) asa_proc_desc,
              ROW_NUMBER () OVER (PARTITION BY ps.enctr_form_id ORDER BY ps.enctr_form_id, psd.prop_seq) AS asa_proc_seq
         FROM cases c
         JOIN page_surgery ps
           ON ps.enctr_form_id = c.enctr_form_id
         JOIN page_surgery_dtl psd
           ON psd.page_id = ps.page_id
          AND psd.prop_nm IN ('asa_proc_cd','asa_proc_sdesc')
        GROUP BY c.fac_id,
                 ps.enctr_form_id,
                 psd.prop_seq
    ),
    asaProceduresFinal AS (
       SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',asa_proc_cd,asa_proc_desc)),'~') asa_procedures
         FROM asaProceduresRaw
        WHERE NOT (asa_proc_cd = '' AND asa_proc_desc = '')
        GROUP BY fac_id,
                 enctr_form_id
    )
    SELECT c.fac_id AS "facilityId",
           CONCAT_WS('^',c.fac_nm_intrnl,c.fac_nm) AS "facility",
           c.enctr_no AS "encounterNumber",
           c.pat_mrn AS "patientMedicalRecordNumber",
           c.admit_dt,
           c.admit_tm,
           c.disch_dt,
           c.disch_tm,
           c.enctr_form_id AS "encounterFormId",
           c.form_defn_title AS "formDefinitionTitle",
           c.form_create_dttm AS "formCreatedTimestamp",
           c.form_update_dttm AS "formUpdatedTimestamp",
           c.form_status AS "formStatus",
           CONCAT_WS('^',c.enctr_pat_last_nm,c.enctr_pat_frst_nm,c.enctr_pat_mid_nm) AS "patientName",
           CONCAT_WS('^',c.enctr_pat_addr_ln_1,c.enctr_pat_addr_ln_2,c.enctr_pat_city,c.enctr_pat_state_cd,c.enctr_pat_zip_cd) AS "patientAddress",
           c.enctr_pat_ph_no_home AS "patientHomePhone",
           c.enctr_pat_ph_no_bus AS "patientWorkPhone",
           c.enctr_pat_ph_no_mob AS "patientMobilePhone",
           c.enctr_pat_email_home AS "patientHomeEmail",
           c.enctr_pat_email_bus AS "patientWorkEmail",
           c.enctr_pat_ssn AS "patientSSN",
           c.enctr_pat_dob AS "patientDob",
           c.pat_gender_cd AS "patientSex",
           c.enctr_pat_marital_status AS "patientMaritalStatus",
           CASE
              WHEN CONCAT_WS('',COALESCE(c.acc_dt::TEXT,''),c.acc_cd,c.acc_desc,c.acc_locn,c.acc_auto_st_cd,c.acc_auto_st_nm,c.acc_job_rel_ind,c.acc_death_ind) <> '' THEN
                 CONCAT_WS('^',COALESCE(c.acc_dt::TEXT,''),c.acc_cd,c.acc_desc,c.acc_locn,c.acc_auto_st_cd,c.acc_auto_st_nm,c.acc_job_rel_ind,c.acc_death_ind)
              ELSE NULL
           END AS "accident",
           c.enctr_guarantor_doc AS "guarantor",
           c.enctr_insurance_doc AS "insurance",
           c.proc_dt AS "dateOfService",
           c.anes_case_typ_cd AS "anesthesiaCaseType",
           c.ob_case_typ_cd AS "obCaseType",
           c.anes_care_model_cd AS "anesthesiaCareModel",
           c.case_cancelled_ind AS "caseCancelledIndicator",
           c.case_cancelled_stg_cd AS "caseCancelledStage",
           crf.cancellation_reasons AS "cancellationReasons",
           c.locn_cd AS "orLocationcode",
           CASE WHEN c.asa_emerg_ind IS NOT DISTINCT FROM TRUE THEN CONCAT_WS('',c.asa_clsfn_cd,'E') ELSE c.asa_clsfn_cd END AS "asaPhysicalStatus",
           c.pat_typ_cd AS "patientType",
           c.prim_anes_typ_cd AS "primaryAnestheticType",
           CASE
              WHEN CONCAT_WS('',surgn_prvr_last_nm,c.surgn_prvr_frst_nm,c.surgn_prvr_natl_prvr_id,c.surgn_prvr_cd) <> '' THEN
                 CONCAT_WS('^',c.surgn_prvr_last_nm,c.surgn_prvr_frst_nm,c.surgn_prvr_natl_prvr_id,c.surgn_prvr_cd)
              ELSE NULL
           END AS "surgeonStaff",
           asf.anes_providers AS "anesthesiaStaff",
           c.surg_st_dt AS "surgeryStartDate",
           c.surg_st_tm AS "surgeryStartTime",
           c.surg_end_dt AS "surgeryEndDate",
           c.surg_end_tm AS "surgeryEndTime",
           c.anes_st_dt AS "anesthesiaStartDate",
           c.anes_st_tm AS "anesthesiaStartTime",
           c.anes_end_dt AS "anesthesiaEndDate",
           c.anes_end_tm AS "anesthesiaEndTime",
           c.epidural_st_dt AS "epiduralStartDate",
           c.epidural_st_tm AS "epiduralStartTime",
           cf.comborbidities AS "comborbidities",
           df.diagnoses AS "postopDiagnoses",
           spf.surgical_procedures AS "surgicalProcedures",
           apf.anesthesia_procedures AS "anesthesiaProcedures",
           asapf.asa_procedures AS "asaProcedures",
           CONCAT_WS('^',c.risk_hypothermia_ind,c.risk_hypotension_ind,c.risk_field_avoidance_ind) AS "riskModifiers",
           aef.comp_descriptions AS "adverseEvents",
           c.in_or_dt AS "inOrDate",
           c.in_or_tm AS "inOrTime",
           c.proc_cmmt_txt AS "procedureComments"`;

    if(params.demographicsOnly === true) {
        query += `
      FROM demog c
        `;
    } else {
        query += `
      FROM cases c
        `;
    }

    query += `
      LEFT JOIN anesProvidersFinal asf
        ON asf.fac_id = c.fac_id
       AND asf.enctr_form_id = c.enctr_form_id
      LEFT JOIN cancellationReasonsFinal crf
        ON crf.fac_id = c.fac_id
       AND crf.enctr_form_id = c.enctr_form_id
      LEFT JOIN complicationsFinal aef
        ON aef.fac_id = c.fac_id
       AND aef.enctr_form_id = c.enctr_form_id
      LEFT JOIN diagnosesFinal df
        ON df.fac_id = c.fac_id
       AND df.enctr_form_id = c.enctr_form_id
      LEFT JOIN comborbiditiesFinal cf
        ON cf.fac_id = c.fac_id
       AND cf.enctr_form_id = c.enctr_form_id
      LEFT JOIN surgicalProceduresFinal spf
        ON spf.fac_id = c.fac_id
       AND spf.enctr_form_id = c.enctr_form_id
      LEFT JOIN anesthesiaProceduresFinal apf
        ON apf.fac_id = c.fac_id
       AND apf.enctR_form_id = c.enctr_form_id
      LEFT JOIN asaProceduresFinal asapf
        ON asapf.fac_id = c.fac_id
       AND asapf.enctr_form_id = c.enctr_form_id
     ORDER BY c.fac_nm_intrnl, c.proc_dt, c.enctr_no, c.form_defn_title, c.form_create_dttm, c.form_update_dttm;
    `;

    let fromTimestamp = moment(params.from).toISOString();
    let toTimestamp = moment(params.to).toISOString();

    let replacements = {
        fromTimestamp: fromTimestamp,
        toTimestamp: toTimestamp,
        facilityId: params.facilityId,
        demographicsOnly: params.demographicsOnly,
        useFacilityTimezone: params.useFacilityTimezone,
        formSelectionMode: params.formSelectionMode,
        sendOnceTagCategory: params.sendOnceTagCategory,
        sendOnceTagName: params.sendOnceTagName,
        completeFormsOnly: params.completeFormsOnly,
        minimumDateBoundary: params.minimumDateBoundary,
        preventFutureDateOfService: params.preventFutureDateOfService,
        allowFormsToAgeDays: params.allowFormsToAgeDays,
        sendOnceIncludeUpdatedForms: params.sendOnceIncludeUpdatedForms
    };

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    try {
        let [rows, queryResult] = await orgModels.queryReadOnly( params.orgInternalName, query, options );
        let results = rows.map((r) => {
            let formattedResult = JSON.parse(JSON.stringify(r));
            if(formattedResult.formCreatedTimestamp) formattedResult.formCreatedTimestamp = moment(formattedResult.formCreatedTimestamp).format();
            if(formattedResult.formUpdatedTimestamp) formattedResult.formUpdatedTimestamp = moment(formattedResult.formUpdatedTimestamp).format();
            return formattedResult;
        });
        return <GetUpdatedEncounterFormsGHStandardBillingResult>{ data: results };
    }
    catch(error) {
         console.log(error);
    }
}

interface GetDataAnomaliesParams {
    orgInternalName:string,
    facilityIds: number[],
    startDate: string,
    endDate: string,
}

interface GetDataAnomaliesResult {
  data: DataAnomaly[];
}

export async function getDataAnomalies(params:GetDataAnomaliesParams):Promise<GetDataAnomaliesResult> {

    let facilityIds =
        _.isArray(params.facilityIds) && params.facilityIds.length > 0
            ? params.facilityIds
            : 'NULL';

    let query = `WITH /* class@EncounterFormService.getDataAnomalies */
      cases AS (
          SELECT f.fac_id,
                  f.fac_nm,
                  e.enctr_no,
                  e.pat_mrn,
                  ef.enctr_form_id,
                  efs.proc_dt,
                  ef.form_cmplt_pct,
                  fd.form_defn_title,
                  (ef.ins_dttm AT TIME ZONE 'US/Central') AS enctr_form_created_on,
                  CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) AS anes_case_ind,
                  CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
                  CASE
                    WHEN efs.anes_case_typ_cd IS NOT NULL AND efs.anes_case_typ_cd = 'STD' THEN 'Standard'
                    WHEN efs.anes_case_typ_cd IS NOT NULL AND efs.anes_case_typ_cd = 'OB' THEN 'OB'
                    WHEN efs.prim_anes_typ_cd IS NOT NULL AND efs. prim_anes_typ_cd = 'LABOR_EPIDURAL' THEN 'OB'
                    WHEN efs.fetal_delivery_a_tm IS NOT NULL THEN 'OB'
                    ELSE 'Unknown'
                  END AS anes_case_typ,
                  (COALESCE(efs.prvr_fac_arriv_dt,efs.proc_dt) + efs.prvr_fac_arriv_tm) AS prvr_fac_arriv_dttm,
                  (COALESCE(efs.proc_sched_st_dt,efs.proc_dt) + efs.proc_sched_st_tm) AS proc_sched_st_dttm,
                  (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
                  (COALESCE(efs.anes_rdy_dt,efs.proc_dt) + efs.anes_rdy_tm) AS anes_rdy_dttm,
                  (COALESCE(efs.surg_st_dt,efs.proc_dt) + efs.surg_st_tm) AS surg_st_dttm,
                  (COALESCE(efs.surg_end_dt,efs.proc_dt) + efs.surg_end_tm) AS surg_end_dttm,
                  (COALESCE(efs.pacu_in_dt,efs.proc_dt) + efs.pacu_in_tm) AS pacu_in_dttm,
                  (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
                  (COALESCE(efs.epidural_st_dt,efs.proc_dt) + efs.epidural_st_tm) AS epidural_st_dttm,
                  (COALESCE(efs.epidural_end_dt,efs.proc_dt) + efs.epidural_end_tm) AS epidural_end_dttm,
                  efs.import_result
            FROM enctr_form_surgery efs
            JOIN enctr_form ef
              ON ef.enctr_form_id = efs.enctr_form_id
              AND ef.void_ind IS DISTINCT FROM TRUE
            JOIN form_defn fd
              ON fd.form_defn_id = ef.form_defn_id
            JOIN enctr e
              ON e.enctr_id = ef.enctr_id
            JOIN fac f
              ON f.fac_id = e.fac_id
            WHERE f.fac_id IN (${facilityIds})
            AND (efs.proc_dt BETWEEN :fromDate AND :toDate OR
                (ef.ins_dttm >= (CAST(:fromDate AT TIME ZONE 'UTC' AS DATE)) AND ef.ins_dttm < (CAST(:toDate AT TIME ZONE 'UTC' AS DATE) + INTERVAL '1 DAY')))
        ),
        caseAnomalies AS (
          SELECT fac_id,
                  enctr_form_id,
                  anes_case_typ,
                  (-- Provider Arrival < -120 mins
                  CASE WHEN (EXTRACT(EPOCH FROM (COALESCE(proc_sched_st_dttm,anes_st_dttm) - prvr_fac_arriv_dttm)/60))::INT < -120 THEN 1 ELSE 0 END +
                  -- Provider Arrival > 120 mins
                  CASE WHEN (EXTRACT(EPOCH FROM (COALESCE(proc_sched_st_dttm,anes_st_dttm) - prvr_fac_arriv_dttm)/60))::INT > 120 THEN 1 ELSE 0 END +
                  -- Total Anesthesia < 0 mins
                  CASE WHEN (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT < 0) THEN 1 ELSE 0 END +
                  -- Total Anesthesia (non-OB) > 720 mins
                  CASE WHEN (anes_case_typ <> 'OB' AND (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT > 720)) THEN 1 ELSE 0 END +
                  -- Total Anesthesia (OB) > 1440 mins
                  CASE WHEN (anes_case_typ = 'OB' AND (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT > 1440)) THEN 1 ELSE 0 END +
                  -- Anesthesia Ready < 0 mins
                  CASE WHEN (EXTRACT(EPOCH FROM ((COALESCE(anes_rdy_dttm,surg_st_dttm) - anes_st_dttm)/60))::INT < 0) THEN 1 ELSE 0 END +
                  -- Anesthesia Ready > 200 mins
                  CASE WHEN (EXTRACT(EPOCH FROM ((COALESCE(anes_rdy_dttm,surg_st_dttm) - anes_st_dttm)/60))::INT > 200) THEN 1 ELSE 0 END +
                  -- Surgical Prep < 0 mins
                  CASE WHEN (EXTRACT(EPOCH FROM ((surg_st_dttm - COALESCE(anes_rdy_dttm,surg_st_dttm))/60))::INT < 0) THEN 1 ELSE 0 END +
                  -- Surgical Prep > 200 mins
                  CASE WHEN (EXTRACT(EPOCH FROM ((surg_st_dttm - COALESCE(anes_rdy_dttm,surg_st_dttm))/60))::INT > 200) THEN 1 ELSE 0 END +
                  -- Total Surgery > 720 mins
                  CASE WHEN (EXTRACT(EPOCH FROM (surg_end_dttm - surg_st_dttm)/60))::INT > 720 THEN 1 ELSE 0 END +
                  -- Emergence > 200 mins
                  CASE WHEN (EXTRACT(EPOCH FROM (anes_end_dttm - surg_end_dttm)/60))::INT > 200 THEN 1 ELSE 0 END +
                  -- Total Epidural > 1440 mins
                  CASE WHEN (EXTRACT(EPOCH FROM (epidural_end_dttm - epidural_st_dttm)/60))::INT > 1440 THEN 1 ELSE 0 END +
                  -- Date of Service does not match Anesthesia Start Date
                  CASE WHEN (proc_dt <> CAST(anes_st_dttm AS DATE)) THEN 1 ELSE 0 END
                  ) AS anomaly_cnt
            FROM cases
            WHERE -- Anomaly Checks:
                  -- Incomplete form
                  form_cmplt_pct < 1
                  -- Provider Arrival < -120 mins
                  OR (EXTRACT(EPOCH FROM (COALESCE(proc_sched_st_dttm,anes_st_dttm) - prvr_fac_arriv_dttm)/60))::INT < -120
                  -- Provider Arrival > 120 mins
                  OR (EXTRACT(EPOCH FROM (COALESCE(proc_sched_st_dttm,anes_st_dttm) - prvr_fac_arriv_dttm)/60))::INT > 120
                  -- Total Anesthesia < 0 mins
                  OR (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT < 0)
                  -- Total Anesthesia (non-OB) > 720 mins
                  OR (anes_case_typ <> 'OB' AND (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT > 720))
                  -- Total Anesthesia (OB) > 1440 mins
                  OR (anes_case_typ = 'OB' AND (((EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60))))::INT > 1440))
                  -- Anesthesia Ready < 0 mins
                  OR (EXTRACT(EPOCH FROM ((COALESCE(anes_rdy_dttm,surg_st_dttm) - anes_st_dttm)/60))::INT < 0)
                  -- Anesthesia Ready > 200 mins
                  OR (EXTRACT(EPOCH FROM ((COALESCE(anes_rdy_dttm,surg_st_dttm) - anes_st_dttm)/60))::INT > 200)
                  -- Surgical Prep < 0 mins
                  OR (EXTRACT(EPOCH FROM ((surg_st_dttm - COALESCE(anes_rdy_dttm,surg_st_dttm))/60))::INT < 0)
                  -- Surgical Prep > 200 mins
                  OR (EXTRACT(EPOCH FROM ((surg_st_dttm - COALESCE(anes_rdy_dttm,surg_st_dttm))/60))::INT > 200)
                  -- Total Surgery > 720 mins
                  OR (EXTRACT(EPOCH FROM (surg_end_dttm - surg_st_dttm)/60))::INT > 720
                  -- Emergence > 200 mins
                  OR (EXTRACT(EPOCH FROM (anes_end_dttm - surg_end_dttm)/60))::INT > 200
                  -- Total Epidural > 1440 mins
                  OR (EXTRACT(EPOCH FROM (epidural_end_dttm - epidural_st_dttm)/60))::INT > 1440
                  -- Gross date anomalies (> +/-1 day from anesthesia start)
                  -- Date of Service does not match Anesthesia Start Date
                  OR (proc_dt <> CAST(anes_st_dttm AS DATE))
                  -- Other timestamps
                  OR ABS((EXTRACT(EPOCH FROM (COALESCE(proc_sched_st_dttm,anes_st_dttm) - anes_st_dttm))/60)::BIGINT) > 1440
                  OR ABS((EXTRACT(EPOCH FROM (COALESCE(anes_rdy_dttm,anes_st_dttm) - anes_st_dttm))/60)::BIGINT) > 1440
                  OR ABS((EXTRACT(EPOCH FROM (COALESCE(surg_st_dttm,anes_st_dttm) - anes_st_dttm))/60)::BIGINT) > 1440
                  OR ABS((EXTRACT(EPOCH FROM (COALESCE(pacu_in_dttm,anes_st_dttm) - anes_st_dttm))/60)::BIGINT) > 1440
                  OR ABS((EXTRACT(EPOCH FROM (COALESCE(prvr_fac_arriv_dttm,anes_st_dttm) - anes_st_dttm))/60)::BIGINT) > 1440
        ),
        caseAudit AS (
          SELECT c.fac_id,
                  c.enctr_form_id,
                  u.usr_id AS form_create_by_id,
                  COALESCE(u.last_nm,'UKNOWN')||', '||COALESCE(u.frst_nm,'UKNOWN')||' ('||COALESCE(u.usr_nm,'')||')' AS form_created_by_nm
            FROM caseAnomalies c
            JOIN aud_log al
              ON al.enctr_form_id = c.enctr_form_id
            JOIN aud_typ atp
              ON atp.aud_typ_id = al.aud_typ_id
              AND atp.aud_typ_cd = 'CREATE_ENCTR_FORM'
            JOIN usr u
              ON u.usr_id = al.aud_usr_id
        ),
        anesProviders AS (
          SELECT fac_id,
                  enctr_form_id,
                  /* introduce a normalized sequence number to eliminate duplicates */
                  ROW_NUMBER() OVER (PARTITION BY fac_id,enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq) AS anes_prvr_seq,
                  anes_prvr_id,
                  anes_prvr_nm
            FROM (SELECT DISTINCT
                          anes_dtl.fac_id,
                          enctr_form_id,
                          anes_prvr_seq,
                          anes_prvr_id,
                          COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'UNKNOWN') AS anes_prvr_nm
                    FROM (SELECT c.fac_id,
                                  c.enctr_form_id,
                                  ps.page_id,
                                  ps.page_nm,
                                  ps.page_no,
                                  psd.prop_seq AS anes_prvr_seq,
                                  MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                            FROM caseAnomalies c
                            JOIN page_surgery ps
                              ON ps.enctr_form_id = c.enctr_form_id
                            JOIN page_surgery_dtl psd
                              ON psd.page_id = ps.page_id
                            WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                            GROUP BY c.fac_id,
                                    c.enctr_form_id,
                                    ps.page_id,
                                    ps.page_nm,
                                    ps.page_no,
                                    psd.prop_seq) anes_dtl
                    JOIN prvr p
                      ON p.prvr_id = anes_dtl.anes_prvr_id
                    WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
        ),
        anesStaff AS (
          SELECT fac_id,
                enctr_form_id,
                ARRAY_AGG(anes_prvr_nm ORDER BY anes_prvr_seq) AS anes_prvrs_list
            FROM anesProviders
          WHERE anes_prvr_seq <= 6
          GROUP BY fac_id,
                    enctr_form_id
        )
        SELECT c.fac_id AS "facilityId",
              c.fac_nm AS "facilityName",
              c.enctr_no AS "encounterNumber",
              c.pat_mrn AS "patientMrn",
              c.enctr_form_id AS "encounterFormId",
              c.anes_case_typ AS "anesCaseTyp",
              COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'UNKNOWN') AS "surgeonProvider",
              ARRAY_TO_STRING(anesStaff.anes_prvrs_list,',') AS "anesProviders",
              c.form_defn_title AS "formTitle",
              c.form_cmplt_pct AS "formCompletePct",
              c.enctr_form_created_on AS "formCreatedOn",
              cad.form_created_by_nm AS "formCreatedByName",
              c.import_result AS "importResult",
              ca.anomaly_cnt AS "anomalyCount",
              c.proc_dt AS "dateOfService",
              c.prvr_fac_arriv_dttm AS "providerArrivalTimestamp",
              c.proc_sched_st_dttm AS "scheduledStartTimestamp",
              c.anes_st_dttm AS "anesthesiaStartTimestamp",
              c.anes_rdy_dttm AS "anesthesiaReadyTimestamp",
              c.surg_st_dttm AS "surgeryStartTimestamp",
              c.surg_end_dttm AS "surgeryEndTimestamp",
              c.pacu_in_dttm AS "pacuArrivalTimestamp",
              c.anes_end_dttm AS "anesthesiaEndTimestamp",
              c.epidural_st_dttm AS "epiduralStartTimestamp",
              c.epidural_end_dttm AS "epiduralEndTimestamp",
                --time intervals
              (EXTRACT(EPOCH FROM ((COALESCE(proc_sched_st_dttm,anes_st_dttm) - prvr_fac_arriv_dttm)/60)))::INT AS "providerArrivalMins",
              (EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60)))::INT AS "totalAnesthesiaMins",
              (EXTRACT(EPOCH FROM ((COALESCE(anes_rdy_dttm,surg_st_dttm) - anes_st_dttm)/60)))::INT AS "totalAnesthesiaReadyMins",
              (EXTRACT(EPOCH FROM ((surg_st_dttm - COALESCE(anes_rdy_dttm,surg_st_dttm))/60)))::INT AS "totalSurgeryPrepMins",
              (EXTRACT(EPOCH FROM (surg_end_dttm - surg_st_dttm)/60))::INT AS "totalSurgeryMins",
              (EXTRACT(EPOCH FROM (anes_end_dttm - surg_end_dttm)/60))::INT AS "totalEmergenceMins",
              (EXTRACT(EPOCH FROM (epidural_end_dttm - epidural_st_dttm)/60))::INT AS "totalEpiduralMins"
          FROM cases c
          JOIN caseAnomalies ca
            ON ca.fac_id = c.fac_id
          AND ca.enctr_form_id = c.enctr_form_id
          LEFT JOIN caseAudit cad
            ON cad.fac_id = c.fac_id
          AND cad.enctr_form_id = c.enctr_form_id
          LEFT JOIN prvr surgn
            ON surgn.prvr_id = c.surgn_prvr_id
          LEFT JOIN anesStaff
            ON anesStaff.fac_id = c.fac_id
          AND anesStaff.enctr_form_id = c.enctr_form_id
          ORDER BY c.fac_nm, c.enctr_no, c.enctr_form_created_on, c.form_defn_title, cad.form_created_by_nm`;

    let fromTimestamp = moment(params.startDate).toISOString();
    let toTimestamp = moment(params.endDate).toISOString();

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: {
            fromDate: fromTimestamp,
            toDate: toTimestamp
        }
    };

    try {
        let [rows, queryResult] = await orgModels.queryReadOnly( params.orgInternalName, query, options );
        let results = rows.map((r) => {
            return <DataAnomaly>{
                facilityId: r.facilityId,
                facilityName: r.facilityName,
                patientMrn: r.patientMrn,
                encounterNumber: r.encounterNumber,
                encounterFormId: r.encounterFormId,
                anesCaseTyp: r.anesCaseTyp,
                surgeonProvider: r.surgeonProvider,
                anesProviders: r.anesProviders ? r.anesProviders.split(',') : null,
                formTitle: r.formTitle,
                formCompletePct: parseFloat(r.formCompletePct),
                formCreatedOn: new Date(r.formCreatedOn),
                formCreatedByName: r.formCreatedByName,
                importResult: JSON.parse(r.importResult),
                anomalyCount: r.anomalyCount,
                dateOfService: r.dateOfService,
                providerArrivalTimestamp: r.providerArrivalTimestamp ? new Date(r.providerArrivalTimestamp) : null,
                scheduledStartTimestamp: r.scheduledStartTimestamp ? new Date(r.scheduledStartTimestamp) : null,
                anesthesiaStartTimestamp: r.anesthesiaStartTimestamp ? new Date(r.anesthesiaStartTimestamp) : null,
                anesthesiaReadyTimestamp: r.anesthesiaReadyTimestamp ? new Date(r.anesthesiaReadyTimestamp) : null,
                surgeryStartTimestamp: r.surgeryStartTimestamp ? new Date(r.surgeryStartTimestamp) : null,
                surgeryEndTimestamp: r.surgeryEndTimestamp ? new Date(r.surgeryEndTimestamp) : null,
                pacuArrivalTimestamp: r.pacuArrivalTimestamp ? new Date(r.pacuArrivalTimestamp) : null,
                anesthesiaEndTimestamp: r.anesthesiaEndTimestamp ? new Date(r.anesthesiaEndTimestamp) : null,
                epiduralStartTimestamp: r.epiduralStartTimestamp ? new Date(r.epiduralStartTimestamp) : null,
                epiduralEndTimestamp: r.epiduralEndTimestamp ? new Date(r.epiduralEndTimestamp) : null,
                providerArrivalMins: r.providerArrivalMins,
                totalAnesthesiaMins: r.totalAnesthesiaMins,
                totalAnesthesiaReadyMins: r.totalAnesthesiaReadyMins,
                totalSurgeryPrepMins: r.totalSurgeryPrepMins,
                totalSurgeryMins: r.totalSurgeryMins,
                totalEmergenceMins: r.totalEmergenceMins,
                totalEpiduralMins: r.totalEpiduralMins
            }
        });
        return <GetDataAnomaliesResult>{ data: results};
    }
    catch(error) {
        console.log(error);
    }
}

interface FindEncounterFormsParams {
  orgInternalName: string;
  facilityId: number;
  encounterFormId?: number;
  encounterNumber?: string;
  patientMrn?: string;
  dateOfService?: string;
  anesthesiaStartTime?: any;
  surgeonNpi?: string;
  anesthesiaProviderNpi?: string;
}

interface FindEncounterFormsResult {
  encounterId: number;
  encounterFormId: number;
}

export async function findMatchingEncounterForms(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
  let query = `WITH /* global.cptImport2019.recordProcessor */
  cases AS (
    SELECT /* global.cptImport2019.recordProcessor */
            f.fac_id,
            e.enctr_id,
            e.enctr_no,
            e.pat_mrn,
            ef.enctr_form_id,
            efs.proc_dt,
            efs.anes_st_tm
      FROM fac f
      JOIN enctr e
        ON e.fac_id = f.fac_id
        AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
      JOIN enctr_form ef
        ON ef.enctr_id = e.enctr_id
        AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
      JOIN enctr_form_surgery efs
        ON efs.enctr_form_id = ef.enctr_form_id
      LEFT JOIN prvr surgn
        ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
      WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
        AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
        AND (
          CASE /* process as many of the match scenarios here as possible in base query */
              WHEN /* match 1 */ :encounterFormId IS NOT NULL AND LENGTH(CAST(:encounterFormId AS TEXT)) > 0 THEN
                ef.enctr_form_id = CAST(:encounterFormId AS BIGINT)
              WHEN /* match 2 */ (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 IS NOT NULL AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0) THEN
                e.enctr_no = :encounterNumber AND
                efs.proc_dt = CAST(:dateOfService AS DATE) AND
                efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
              WHEN /* match 3 */ (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0) THEN
                e.pat_mrn = :patientMrn AND
                efs.proc_dt = CAST(:dateOfService AS DATE) AND
                efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
              WHEN /* match 4 */ (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0  AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0) THEN
                e.enctr_no = :encounterNumber AND
                efs.proc_dt = CAST(:dateOfService AS DATE) AND
                surgn.natl_prvr_id = :surgeonNpi
              WHEN /* match 5 */ (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0) THEN
                e.pat_mrn = :patientMrn AND
                efs.proc_dt = CAST(:dateOfService AS DATE) AND
                surgn.natl_prvr_id = :surgeonNpi
              ELSE TRUE /* other match scenarios will be matched in the final query */
          END
        )
  ),
  anesProviders AS (
    SELECT fac_id,
            enctr_form_id,
            /* introduce a normalized sequence number to eliminate duplicates */
            ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
            anes_prvr_npi
      FROM (SELECT DISTINCT
                    p.fac_id,
                    enctr_form_id,
                    anes_prvr_seq,
                    p.natl_prvr_id AS anes_prvr_npi
              FROM (SELECT c.fac_id,
                            c.enctr_form_id,
                            ps.page_id,
                            ps.page_nm,
                            ps.page_no,
                            psd.prop_seq AS anes_prvr_seq,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                      FROM cases c
                      JOIN page_surgery ps
                        ON ps.enctr_form_id = c.enctr_form_id
                      JOIN page_surgery_dtl psd
                        ON psd.page_id = ps.page_id
                      WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                      GROUP BY c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq) anesPrvrDetail
      JOIN prvr p
        ON p.prvr_id = anesPrvrDetail.anes_prvr_id
        AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
  ),
  anesStaff AS (
    SELECT fac_id,
            enctr_form_id,
            ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
      FROM anesProviders
      GROUP BY fac_id,
              enctr_form_id
  )
  SELECT cases.enctr_id AS "encounterId",
        cases.enctr_form_id AS "encounterFormId"
    FROM cases
    LEFT JOIN anesStaff a
      ON a.fac_id = cases.fac_id
    AND a.enctr_form_id = cases.enctr_form_id
  WHERE (CASE
            WHEN /* match 6 */ (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0) THEN
                cases.enctr_no = :encounterNumber AND
                cases.proc_dt = CAST(:dateOfService AS DATE) AND
                a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%'
            WHEN /* match 7 */ (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0) THEN
                cases.pat_mrn = :patientMrn AND
                cases.proc_dt = CAST(:dateOfService AS DATE) AND
                a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%'
            WHEN /* match 8 */ (:anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0) THEN
                cases.proc_dt = CAST(:dateOfService AS DATE) AND
                cases.anes_st_tm = CAST(:anesthesiaStartTime AS TIME) AND
                a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%'
          END);`;
  let replacements = {
    orgInternalName: params.orgInternalName,
    facilityId: params.facilityId,
    encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
    encounterNumber: params.encounterNumber || null,
    patientMrn: params.patientMrn || null,
    dateOfService: params.dateOfService || null,
    anesthesiaStartTime: params.anesthesiaStartTime || null,
    surgeonNpi: params.surgeonNpi || null,
    anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
  };
  //console.log(replacements);

  let options = <QueryOptions>{
      type: QueryTypes.RAW,
      replacements: replacements
  };

  let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
  let results = rows.map((r) => {
      return <FindEncounterFormsResult>{
        encounterId: parseInt(r.encounterId),
        encounterFormId: parseInt(r.encounterFormId)
      }
  });
  return results;
}

export async function cptImport2019EncounterFormMatch01(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch01 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
          /* match 1 */
          AND (:encounterFormId IS NOT NULL AND LENGTH(CAST(:encounterFormId AS TEXT)) > 0)
          AND ef.enctr_form_id = CAST(:encounterFormId AS BIGINT)
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch02(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch02 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
          /* match 2 */
          AND (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 IS NOT NULL AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0)
          AND e.enctr_no = :encounterNumber
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch03(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch03 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
          /* match 3 */
          AND (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0)
          AND e.pat_mrn = :patientMrn
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch04(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch04 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
          /* match 4 */
          AND (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0  AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0)
          AND e.enctr_no = :encounterNumber
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND surgn.natl_prvr_id = :surgeonNpi
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch05(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch05 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
          /* match 5 */
          AND (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0)
          AND e.pat_mrn = :patientMrn
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND surgn.natl_prvr_id = :surgeonNpi
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch06(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch06 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases
      LEFT JOIN anesStaff a
        ON a.fac_id = cases.fac_id
      AND a.enctr_form_id = cases.enctr_form_id
    WHERE /* match 6 */
          (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0)
      AND cases.enctr_no = :encounterNumber
      AND cases.proc_dt = CAST(:dateOfService AS DATE)
      AND a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch07(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch07 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases
      LEFT JOIN anesStaff a
        ON a.fac_id = cases.fac_id
      AND a.enctr_form_id = cases.enctr_form_id
      WHERE /* match 7 */
            (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0)
        AND cases.pat_mrn = :patientMrn
        AND cases.proc_dt = CAST(:dateOfService AS DATE)
        AND a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
  }

  export async function cptImport2019EncounterFormMatch08(params:FindEncounterFormsParams):Promise<FindEncounterFormsResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImport2019EncounterFormMatch08 */
    cases AS (
      SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
        FROM fac f
        JOIN enctr e
          ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
        JOIN enctr_form ef
          ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
        JOIN enctr_form_surgery efs
          ON efs.enctr_form_id = ef.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE f.fac_id = CAST(:facilityId AS INTEGER) -- mandatory parameter, from Flow context
          AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
          cases.enctr_form_id AS "encounterFormId"
      FROM cases
      LEFT JOIN anesStaff a
        ON a.fac_id = cases.fac_id
      AND a.enctr_form_id = cases.enctr_form_id
    WHERE /* match 8 */
          (:anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0)
      AND cases.proc_dt = CAST(:dateOfService AS DATE)
      AND cases.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
      AND a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: params.facilityId,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <FindEncounterFormsResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId)
        }
    });
    return results;
}

interface CptImportMatchParams {
  orgInternalName: string;
  facilityId?: number;
  encounterFormId?: number;
  encounterNumber?: string;
  patientMrn?: string;
  dateOfService?: string;
  anesthesiaStartTime?: any;
  surgeonNpi?: string;
  anesthesiaProviderNpi?: string;
}

interface CptImportMatchResult {
  encounterId: number;
  encounterFormId: number;
  facilityId: number;
}

export async function cptImportEncounterFormMatch01(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch01 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
         WHERE (CASE
                   WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                   ELSE TRUE
                END)
           /* do not allow matching any case older than the prior year */
           AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
           /* do not allow matching any case later than the current date */
           AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
           /* match 1 */
           AND (:encounterFormId IS NOT NULL AND LENGTH(CAST(:encounterFormId AS TEXT)) > 0)
           AND ef.enctr_form_id = CAST(:encounterFormId AS BIGINT)
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch02(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch02 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 2 */
          AND (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 IS NOT NULL AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0)
          AND e.enctr_no = :encounterNumber
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch03(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch03 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 3 */
          AND (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0)
          AND e.pat_mrn = :patientMrn
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch04(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch04 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
         JOIN prvr surgn
           ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 4 */
          AND (:encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0  AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0)
          AND e.enctr_no = :encounterNumber
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND surgn.natl_prvr_id = :surgeonNpi
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch05(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch05 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
         JOIN prvr surgn
           ON surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 5 */
          AND (:patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :surgeonNpi IS NOT NULL AND LENGTH(:surgeonNpi) > 0)
          AND e.pat_mrn = :patientMrn
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND surgn.natl_prvr_id = :surgeonNpi
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases;`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch06(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch06 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 6 */
          AND efs.enctr_no = :encounterNumber
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases
      JOIN anesStaff a
        ON a.fac_id = cases.fac_id
       AND a.enctr_form_id = cases.enctr_form_id
     WHERE /* match 6 */
           (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :encounterNumber IS NOT NULL AND LENGTH(:encounterNumber) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0)
       AND a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch07(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch07 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 7 */
          AND efs.pat_mrn = :patientMrn
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases
      JOIN anesStaff a
        ON a.fac_id = cases.fac_id
       AND a.enctr_form_id = cases.enctr_form_id
     WHERE /* match 7 */
           (anes_staff IS NOT NULL AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0 AND :patientMrn IS NOT NULL AND LENGTH(:patientMrn) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0)
       AND a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
  }

  export async function cptImportEncounterFormMatch08(params:CptImportMatchParams):Promise<CptImportMatchResult[]> {
    let query = `WITH /* class@EncounterFormService.cptImportEncounterFormMatch08 */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              e.pat_mrn,
              ef.enctr_form_id,
              efs.proc_dt,
              efs.anes_st_tm
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
        WHERE (CASE
                  WHEN :facilityId IS NOT NULL THEN f.fac_id = CAST(:facilityId AS INTEGER)
                  ELSE TRUE
               END)
          /* do not allow matching any case older than the prior year */
          AND (efs.proc_dt > (CAST(date_trunc('year', CAST(CURRENT_TIMESTAMP AT TIME ZONE 'US/Central' AS DATE) - INTERVAL '1 year') - INTERVAL '1 day' AS DATE))
          /* do not allow matching any case later than the current date */
          AND efs.proc_dt <= (CURRENT_TIMESTAMP AT TIME ZONE 'US/Central')::DATE)
          /* match 8 */
          AND (:anesthesiaStartTime IS NOT NULL AND LENGTH(:anesthesiaStartTime) > 0 AND :dateOfService IS NOT NULL AND LENGTH(:dateOfService) > 0 AND :anesthesiaProviderNpi IS NOT NULL AND LENGTH(:anesthesiaProviderNpi) > 0)
          AND efs.proc_dt = CAST(:dateOfService AS DATE)
          AND efs.anes_st_tm = CAST(:anesthesiaStartTime AS TIME)
    ),
    anesProviders AS (
      SELECT fac_id,
              enctr_form_id,
              /* introduce a normalized sequence number to eliminate duplicates */
              ROW_NUMBER() OVER (PARTITION BY fac_id, enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq NULLS LAST) AS anes_prvr_seq,
              anes_prvr_npi
        FROM (SELECT DISTINCT
                      p.fac_id,
                      enctr_form_id,
                      anes_prvr_seq,
                      p.natl_prvr_id AS anes_prvr_npi
                FROM (SELECT c.fac_id,
                              c.enctr_form_id,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq AS anes_prvr_seq,
                              MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
                        FROM cases c
                        JOIN page_surgery ps
                          ON ps.enctr_form_id = c.enctr_form_id
                        JOIN page_surgery_dtl psd
                          ON psd.page_id = ps.page_id
                        WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
                        GROUP BY c.fac_id,
                                c.enctr_form_id,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq) anesPrvrDetail
        JOIN prvr p
          ON p.prvr_id = anesPrvrDetail.anes_prvr_id
          AND anesPrvrDetail.anes_prvr_id IS NOT NULL) prvrs
    ),
    anesStaff AS (
      SELECT fac_id,
              enctr_form_id,
              ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi ORDER BY anes_prvr_seq),',') anes_staff
        FROM anesProviders
        GROUP BY fac_id,
                enctr_form_id
    )
    SELECT cases.enctr_id AS "encounterId",
           cases.enctr_form_id AS "encounterFormId",
           cases.fac_id AS "facilityId"
      FROM cases
      JOIN anesStaff a
        ON a.fac_id = cases.fac_id
       AND a.enctr_form_id = cases.enctr_form_id
     WHERE /* match 8 */
           a.anes_staff LIKE '%'||:anesthesiaProviderNpi||'%';`;
    let replacements = {
      orgInternalName: params.orgInternalName,
      facilityId: _.isInteger(params.facilityId) ? params.facilityId : null,
      encounterFormId: _.isInteger(params.encounterFormId) ? params.encounterFormId : null,
      encounterNumber: params.encounterNumber || null,
      patientMrn: params.patientMrn || null,
      dateOfService: params.dateOfService || null,
      anesthesiaStartTime: params.anesthesiaStartTime || null,
      surgeonNpi: params.surgeonNpi || null,
      anesthesiaProviderNpi: params.anesthesiaProviderNpi || null,
    };
    //console.log(replacements);

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements
    };

    let [rows, queryResult] = await orgModels.query( params.orgInternalName, query, options );
    let results = rows.map((r) => {
        return <CptImportMatchResult>{
          encounterId: parseInt(r.encounterId),
          encounterFormId: parseInt(r.encounterFormId),
          facilityId: parseInt(r.facilityId)
        }
    });
    return results;
}

interface GetEncounterFormsWithDiagnosesParams {
    orgInternalName: string;
    facilityId: number;
    encounterNumber: string;
    dateOfService: string;
}

interface GetEncounterFormsWithDiagnosesResult {
    encounterId: number;
    encounterFormId: number;
    facilityId: number;
    maxDiagnosisSequence: number;
    diagnosisList: string;
}

export async function getEncounterFormsWithDiagnoses(
    params: GetEncounterFormsWithDiagnosesParams,
): Promise<GetEncounterFormsWithDiagnosesResult[]> {
    let query = `WITH /* class@EncounterFormService.getEncounterFormsWithDiagnoses */
    cases AS (
       SELECT f.fac_id,
              e.enctr_id,
              e.enctr_no,
              ef.enctr_form_id,
              efs.proc_dt
         FROM fac f
         JOIN enctr e
           ON e.fac_id = f.fac_id
          AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
         JOIN enctr_form ef
           ON ef.enctr_id = e.enctr_id
          AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
         JOIN form_defn fd
           ON fd.form_defn_id = ef.form_defn_id
          AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
         JOIN enctr_form_surgery efs
           ON efs.enctr_form_id = ef.enctr_form_id
         WHERE f.fac_id = CAST(:facilityId AS INTEGER)
          AND e.enctr_no = :encounterNumber
           AND efs.proc_dt = CAST(:dateOfService AS DATE)
    ),
    diagnosesRaw AS (
       SELECT c.fac_id,
              ps.enctr_form_id,
              psd.prop_seq AS icd_diag_seq,
              MAX(CASE WHEN prop_nm = 'icd_diag_cd' THEN prop_val ELSE '' END ORDER BY prop_seq) icd_diag_cd,
              MAX(CASE WHEN prop_nm = 'diag_text' THEN prop_val ELSE '' END ORDER BY prop_seq) icd_diag_desc,
              MAX(psd.prop_seq) OVER (PARTITION BY c.fac_id, ps.enctr_form_id) AS max_icd_diag_seq
         FROM cases c
         JOIN page_surgery ps
           ON ps.enctr_form_id = c.enctr_form_id
         JOIN page_surgery_dtl psd
           ON psd.page_id = ps.page_id
          AND psd.prop_nm IN ('icd_diag_cd','diag_text')
        WHERE psd.prop_val IS NOT NULL
        GROUP BY c.fac_id,
                 ps.enctr_form_id,
                 psd.prop_seq
    )
    SELECT c.enctr_id AS "encounterId",
           c.enctr_form_id AS "encounterFormId",
           c.fac_id AS "facilityId",
           COALESCE(d.max_icd_diag_seq,0) AS "maxDiagnosisSequence",
           NULLIF(ARRAY_TO_STRING(ARRAY_AGG(CONCAT_WS('^',icd_diag_seq,icd_diag_cd,COALESCE(icd_diag_desc,''))),'~'),'') AS "diagnosisList"
      FROM cases c
      LEFT JOIN diagnosesRaw d
        ON d.fac_id = c.fac_id
       AND d.enctr_form_id = c.enctr_form_id
       AND d.icd_diag_cd IS NOT NULL
       AND LENGTH(d.icd_diag_cd) > 0
     GROUP BY 1,2,3,4;`;

    let replacements = {
        orgInternalName: params.orgInternalName,
        facilityId: _.isInteger(Number(params.facilityId)) ? params.facilityId : null,
        encounterNumber: params.encounterNumber,
        dateOfService: params.dateOfService,
    };

    let options = <QueryOptions>{
        type: QueryTypes.RAW,
        replacements: replacements,
    };

    let [rows, queryResult] = await orgModels.query(params.orgInternalName, query, options);
    let results = rows.map((r) => {
        return <GetEncounterFormsWithDiagnosesResult>{
            encounterId: parseInt(r.encounterId),
            encounterFormId: parseInt(r.encounterFormId),
            facilityId: parseInt(r.facilityId),
            maxDiagnosisSequence: parseInt(r.maxDiagnosisSequence),
            diagnosisList: r.diagnosisList,
        };
    });
    return results;
}