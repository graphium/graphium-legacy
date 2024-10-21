import { Transaction, Sequelize, QueryOptions, QueryTypes } from 'sequelize';
import * as _ from 'lodash';
import * as moment from 'moment';

import * as orgModels from '../model/OrgModels.js';
import { getFrameworkConnection } from '../v2/entity/connections';
import * as s3Util  from '../util/s3Util';
import * as OrgSettingDAO from '../dao/OrgSettingDAO';
import { QcdrFacilitySetting } from '../model/flow/QCDRFacilitySetting';
import { QcdrGeneralSettings } from '../model/flow/QcdrGeneralSettings';
import * as Qcdr2019Settings from '../model/macra/Qcdr2019GeneralSettings';
import { QcdrProviderSettings } from '../model/macra/Qcdr2018ProviderSettings';
import { PqrsProvider, PqrsProvider2019 } from '../model/PQRSProvider';

function persistDataToS3(orgInternalName, facilityId, startDate, endDate, results) {
    s3Util.persistDataToS3()
}

export async function get2018Providers(orgInternalName:string):Promise<PqrsProvider[]> {
    let query = `WITH
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
    casesFor2018 AS (
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
          AND efs.proc_dt BETWEEN '2018-01-01' AND '2018-12-31'   -- only 2018 cases
    ),
    providersWith2018Cases AS (
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
                         FROM casesFor2018 cases
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
         FROM providersWith2018Cases
        WHERE anes_prvr_seq <= 6
        GROUP BY fac_id,
                 anes_prvr_id
    )
    SELECT f.fac_id               "facilityId",
           f.fac_nm               "facilityName",
           f.fac_actv_ind         "facilityIsActive",
           f.prvr_id              "providerId",
           f.natl_prvr_id         "providerNpi",
           f.last_nm              "providerLastName",
           f.frst_nm              "providerFirstName",
           f.prvr_typ             "providerType",
           f.prvr_actv_ind        "providerIsActive",
           CASE
              WHEN a.anes_prvr_id IS NOT NULL THEN TRUE
              ELSE FALSE
           END                    "providerHas2018Cases",
           COALESCE(a.case_cnt,0) "provider2018CaseCount"
      FROM facilityProviders f
      LEFT JOIN anes_staff a
        ON a.fac_id = f.fac_id
       AND a.anes_prvr_id = f.prvr_id
     ORDER BY f.fac_nm,
              f.last_nm,
              f.frst_nm,
              f.natl_prvr_id`;

        let queryOptions = {
            type: QueryTypes.SELECT,
      }

      let providers = await orgModels.query(orgInternalName, query, queryOptions);

      return providers;
}

export async function get2019Providers(orgInternalName:string):Promise<PqrsProvider2019[]> {
  let query = `WITH
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
  casesFor2019 AS (
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
        AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'   -- only 2019 cases
  ),
  providersWith2019Cases AS (
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
                       FROM casesFor2019 cases
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
       FROM providersWith2019Cases
      WHERE anes_prvr_seq <= 6
      GROUP BY fac_id,
               anes_prvr_id
  )
  SELECT f.fac_id               "facilityId",
         f.fac_nm               "facilityName",
         f.fac_actv_ind         "facilityIsActive",
         f.prvr_id              "providerId",
         f.natl_prvr_id         "providerNpi",
         f.last_nm              "providerLastName",
         f.frst_nm              "providerFirstName",
         f.prvr_typ             "providerType",
         f.prvr_actv_ind        "providerIsActive",
         CASE
            WHEN a.anes_prvr_id IS NOT NULL THEN TRUE
            ELSE FALSE
         END                    "providerHas2019Cases",
         COALESCE(a.case_cnt,0) "provider2019CaseCount"
    FROM facilityProviders f
    LEFT JOIN anes_staff a
      ON a.fac_id = f.fac_id
     AND a.anes_prvr_id = f.prvr_id
   ORDER BY f.fac_nm,
            f.last_nm,
            f.frst_nm,
            f.natl_prvr_id`;

      let queryOptions = {
          type: QueryTypes.SELECT,
    }

    let providers = await orgModels.query(orgInternalName, query, queryOptions);

    return providers;
}

export async function getQcdrFacilitySettings(orgInternalName:string):Promise<QcdrFacilitySetting[]>
{
    const settingName = 'qcdr.facilitySettings';
    var facilitySettingsSetting:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(facilitySettingsSetting && facilitySettingsSetting.settingValue) {
        return facilitySettingsSetting.settingValue.facilitySettings || [];
    }
    return [];
}

export async function updateQcdrFacilitySettings(orgInternalName:string, facilitySettings:QcdrFacilitySetting[]):Promise<boolean> {
    if(!_.isArray(facilitySettings)) {
        throw new Error('Must pass in an array of facility settings.');
    }

    const settingName = 'qcdr.facilitySettings';
    let setting = {
        lastUpdatedAt: Date.now(),
        facilitySettings: facilitySettings
    };

    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, setting);
    return true;
}

export async function getQcdrGeneralSettings(orgInternalName:string):Promise<QcdrGeneralSettings>
{
    const settingName = 'qcdr.2018.generalSettings';
    var generalSettingResult:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(generalSettingResult && generalSettingResult.settingValue) {
      return generalSettingResult.settingValue || null;
    }
    return null;
}

export async function updateQcdrGeneralSettings(orgInternalName:string, generalSettings:QcdrGeneralSettings):Promise<boolean> {
    const settingName = 'qcdr.2018.generalSettings';
    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, generalSettings);
    return true;
}

export async function getQcdr2019GeneralSettings(orgInternalName:string):Promise<Qcdr2019Settings.QcdrGeneralSettings>
{
    const settingName = 'qcdr.2019.generalSettings';
    var generalSettingResult:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(generalSettingResult && generalSettingResult.settingValue) {
      return generalSettingResult.settingValue || null;
    }
    return null;
}

export async function updateQcdr2019GeneralSettings(orgInternalName:string, generalSettings:Qcdr2019Settings.QcdrGeneralSettings):Promise<boolean> {
    const settingName = 'qcdr.2019.generalSettings';
    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, generalSettings);
    return true;
}

export async function getQcdrProviderSettings(orgInternalName:string):Promise<QcdrProviderSettings>
{
    const settingName = 'qcdr.providerSettings';
    var providerSettingsResult:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(providerSettingsResult && providerSettingsResult.settingValue) {

      if(providerSettingsResult.settingValue.json) {
        return JSON.parse(providerSettingsResult.settingValue.json)
      }
      else {
        return providerSettingsResult.settingValue || null;
      }
    }
    return null;
}

export async function updateQcdrProviderSettings(orgInternalName:string, providerSettings:QcdrProviderSettings):Promise<boolean> {
    console.log('Saving settings:');
    console.log(providerSettings);
    const settingName = 'qcdr.providerSettings';
    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, { json: JSON.stringify(providerSettings) });
    return true;
}

export function getMacra2017Results(orgInternalName:string, facilityIds:number[], startDate:string, endDate:string) {
  var query =
    `WITH cases AS (
    SELECT f.fac_id,
            e.enctr_id,
            e.enctr_no AS enctr_enctr_no,
            efs.enctr_form_id,
            efs.proc_dt,
            COALESCE(efs.anes_st_dt,efs.proc_dt) AS anes_st_dt,
            efs.anes_st_tm,
            COALESCE(efs.anes_end_dt,efs.proc_end_dt,efs.proc_dt) AS anes_end_dt,
            efs.anes_end_tm,
            CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
            efs.qcdr_eval_result,
            efs.qcdr_missing_data_count,
            efs.qcdr_eval_dttm,
            efs.qcdr_eval_enctr_form_ver,
            efs.import_result
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
      WHERE f.fac_id IN (:facilityIds)
        AND efs.proc_dt BETWEEN :startDate AND :endDate
        AND efs.prim_anes_typ_cd IS DISTINCT FROM 'LABOR_EPIDURAL'
  ),
  anes_prvrs AS (
    SELECT fac_id,
            enctr_form_id,
            anes_prvr_typ,
            /* introduce a normalized sequence number to eliminate duplicates */
            ROW_NUMBER() OVER (PARTITION BY fac_id,enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq, anes_prvr_st_dt, anes_prvr_st_tm NULLS LAST) AS anes_prvr_seq,
            anes_prvr_id,
            anes_prvr_nm
      FROM (SELECT DISTINCT
                    anes_dtl.fac_id,
                    enctr_form_id,
                    anes_prvr_typ,
                    anes_prvr_seq,
                    anes_prvr_id,
                    COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'UNKNOWN') AS anes_prvr_nm,
                    COALESCE(anes_dtl.anes_prvr_st_dt,anes_dtl.anes_st_dt) AS anes_prvr_st_dt,
                    COALESCE(anes_dtl.anes_prvr_st_tm,anes_dtl.anes_st_tm) AS anes_prvr_st_tm
              FROM (SELECT cases.fac_id,
                            cases.enctr_form_id,
                            cases.enctr_id,
                            cases.anes_st_dt,
                            cases.anes_st_tm,
                            ps.page_id,
                            ps.page_nm,
                            ps.page_no,
                            psd.prop_seq AS anes_prvr_seq,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_typ'::text THEN psd.prop_val ELSE NULL END) AS anes_prvr_typ,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_dt_asmd_care'::text THEN psd.prop_val::DATE ELSE NULL::DATE END) AS anes_prvr_st_dt,
                            MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_tm_asmd_care'::text THEN psd.prop_val::TIME ELSE NULL::TIME END) AS anes_prvr_st_tm
                      FROM cases
                      JOIN page_surgery ps
                        ON ps.enctr_form_id = cases.enctr_form_id
                      JOIN page_surgery_dtl psd
                        ON psd.page_id = ps.page_id
                      WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id,anes_prvr_typ}'::text[]))
                      GROUP BY cases.fac_id,
                              cases.enctr_form_id,
                              cases.enctr_id,
                              cases.anes_st_dt,
                              cases.anes_st_tm,
                              ps.page_id,
                              ps.page_nm,
                              ps.page_no,
                              psd.prop_seq) anes_dtl
              JOIN prvr p
                ON p.prvr_id = anes_dtl.anes_prvr_id
              WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
  ),
  anes_staff AS (
    SELECT fac_id,
            enctr_form_id,
            ARRAY_AGG(anes_prvr_id||'|'||anes_prvr_typ||'|'||anes_prvr_nm) AS anes_prvrs_list
      FROM anes_prvrs
      WHERE anes_prvr_seq <= 6
      GROUP BY fac_id,
              enctr_form_id
  )
  SELECT cases.fac_id AS "facilityId",
        enctr_id AS "encounterId",
        enctr_enctr_no AS "encounterNumber",
        cases.enctr_form_id AS "encounterFormId",
        proc_dt AS "dos",
        anes_st_dt AS "anesStartDate",
        anes_st_tm AS "anesStartTime",
        anes_end_dt AS "anesEndDate",
        anes_end_tm AS "anesEndTime",
        qcdr_eval_result AS "qcdrEvalResult",
        qcdr_missing_data_count AS "qcdrMissingDataCount",
        qcdr_eval_dttm AS "qcdrEvalDateTime",
        import_result AS "importResult",
        (surgn.prvr_id||'|'||COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'UNKNOWN')) AS "surgeonProvider",
        ARRAY_TO_STRING(anes_staff.anes_prvrs_list,',') AS "anesProviders"
    FROM cases
    LEFT JOIN anes_staff
      ON anes_staff.fac_id = cases.fac_id
    AND anes_staff.enctr_form_id = cases.enctr_form_id
    LEFT JOIN prvr surgn
      ON surgn.fac_id = cases.fac_id
    AND surgn.prvr_id = cases.surgn_prvr_id`;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityIds: facilityIds,
      startDate: startDate,
      endDate: endDate
    }
  };
  if(!facilityIds || facilityIds.length < 1)
    throw new Error('Facility IDs parameter is not set or is not an integer.');

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  return orgModels.query(orgInternalName, query, queryOptions)
  .then(function(results) {
    //console.log(results[0]);
    var parsedResults = _.map(results, function(result:any) {
      result.qcdrEvalResult = result.qcdrEvalResult != null ? JSON.parse(result.qcdrEvalResult) : null;
      // It seems that an old version of the logic sometimes double serialized the string. So we detect if the initial
      // JSON parse returns a single string, and if so we parse it again.
      if(_.isString(result.qcdrEvalResult)) {
        result.qcdrEvalResult = JSON.parse(result.qcdrEvalResult);
      }

      var anesProviders = [];
      if(result.anesProviders) {
        var providerStrings = result.anesProviders.split(',');
        providerStrings.forEach((providerString) => {
          var providerStringParts = providerString.split('|');
          anesProviders.push({
            providerId: providerStringParts[0],
            providerType: providerStringParts[1],
            providerName: providerStringParts[2],
          })
        })
      }

      if(result.surgeonProvider) {
        var surgeonParts = result.surgeonProvider.split('|');
        result.surgeonProvider = {
          providerId: surgeonParts[0],
          providerName: surgeonParts[1],
          providerType: 'SURGEON'
        }
      }

      if(result.importResult) {
        result.importResult = JSON.parse(result.importResult);
      }

      result.anesProviders = anesProviders;
      return result;
    });
    return Promise.resolve(parsedResults);
  });
}

export function getMacra2019Results(orgInternalName:string, facilityIds:number[], startDate:string, endDate:string) {
  var query =
    `WITH cases AS (
        SELECT f.fac_id,
                e.enctr_id,
                e.enctr_no AS enctr_enctr_no,
                ef.form_cmplt_pct,
                efs.enctr_form_id,
                efs.proc_dt,
                COALESCE(efs.anes_st_dt,efs.proc_dt) AS anes_st_dt,
                efs.anes_st_tm,
                COALESCE(efs.anes_end_dt,efs.proc_end_dt,efs.proc_dt) AS anes_end_dt,
                efs.anes_end_tm,
                CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
                efs.qcdr_eval_result,
                efs.qcdr_eval_result_projected,
                efs.qcdr_missing_data_count,
                efs.qcdr_eval_dttm,
                efs.qcdr_eval_enctr_form_ver,
                efs.import_result
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
          WHERE f.fac_id IN (:facilityIds)
            AND efs.proc_dt BETWEEN :startDate AND :endDate
      ),
      anes_prvrs AS (
        SELECT fac_id,
                enctr_form_id,
                anes_prvr_typ,
                /* introduce a normalized sequence number to eliminate duplicates */
                ROW_NUMBER() OVER (PARTITION BY fac_id,enctr_form_id ORDER BY fac_id, enctr_form_id, anes_prvr_seq, anes_prvr_st_dt, anes_prvr_st_tm NULLS LAST) AS anes_prvr_seq,
                anes_prvr_id,
                anes_prvr_nm
          FROM (SELECT DISTINCT
                        anes_dtl.fac_id,
                        enctr_form_id,
                        anes_prvr_typ,
                        anes_prvr_seq,
                        anes_prvr_id,
                        COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'UNKNOWN') AS anes_prvr_nm,
                        COALESCE(anes_dtl.anes_prvr_st_dt,anes_dtl.anes_st_dt) AS anes_prvr_st_dt,
                        COALESCE(anes_dtl.anes_prvr_st_tm,anes_dtl.anes_st_tm) AS anes_prvr_st_tm
                  FROM (SELECT cases.fac_id,
                                cases.enctr_form_id,
                                cases.enctr_id,
                                cases.anes_st_dt,
                                cases.anes_st_tm,
                                ps.page_id,
                                ps.page_nm,
                                ps.page_no,
                                psd.prop_seq AS anes_prvr_seq,
                                MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_typ'::text THEN psd.prop_val ELSE NULL END) AS anes_prvr_typ,
                                MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id,
                                MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_dt_asmd_care'::text THEN psd.prop_val::DATE ELSE NULL::DATE END) AS anes_prvr_st_dt,
                                MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_tm_asmd_care'::text THEN psd.prop_val::TIME ELSE NULL::TIME END) AS anes_prvr_st_tm
                          FROM cases
                          JOIN page_surgery ps
                            ON ps.enctr_form_id = cases.enctr_form_id
                          JOIN page_surgery_dtl psd
                            ON psd.page_id = ps.page_id
                          WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id,anes_prvr_typ}'::text[]))
                          GROUP BY cases.fac_id,
                                  cases.enctr_form_id,
                                  cases.enctr_id,
                                  cases.anes_st_dt,
                                  cases.anes_st_tm,
                                  ps.page_id,
                                  ps.page_nm,
                                  ps.page_no,
                                  psd.prop_seq) anes_dtl
                  JOIN prvr p
                    ON p.prvr_id = anes_dtl.anes_prvr_id
                  WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
      ),
      anes_staff AS (
        SELECT fac_id,
                enctr_form_id,
                ARRAY_AGG(anes_prvr_id||'|'||anes_prvr_typ||'|'||anes_prvr_nm) AS anes_prvrs_list
          FROM anes_prvrs
          WHERE anes_prvr_seq <= 6
          GROUP BY fac_id,
                  enctr_form_id
      )
      SELECT cases.fac_id AS "facilityId",
            enctr_id AS "encounterId",
            enctr_enctr_no AS "encounterNumber",
            cases.enctr_form_id AS "encounterFormId",
            cases.form_cmplt_pct AS "formCompletePct",
            proc_dt AS "dos",
            anes_st_dt AS "anesStartDate",
            anes_st_tm AS "anesStartTime",
            anes_end_dt AS "anesEndDate",
            anes_end_tm AS "anesEndTime",
            qcdr_eval_result AS "qcdrEvalResult",
            qcdr_eval_result_projected AS "qcdrEvalResultProjected",
            qcdr_missing_data_count AS "qcdrMissingDataCount",
            qcdr_eval_dttm AS "qcdrEvalDateTime",
            import_result AS "importResult",
            (surgn.prvr_id||'|'||COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'UNKNOWN')) AS "surgeonProvider",
            ARRAY_TO_STRING(anes_staff.anes_prvrs_list,',') AS "anesProviders"
        FROM cases
        LEFT JOIN anes_staff
          ON anes_staff.fac_id = cases.fac_id
        AND anes_staff.enctr_form_id = cases.enctr_form_id
        LEFT JOIN prvr surgn
          ON surgn.fac_id = cases.fac_id
        AND surgn.prvr_id = cases.surgn_prvr_id`;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityIds: facilityIds,
      startDate: startDate,
      endDate: endDate
    }
  };
  if(!facilityIds || facilityIds.length < 1)
    throw new Error('Facility IDs parameter is not set or is not an integer.');

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  return orgModels.query(orgInternalName, query, queryOptions)
  .then(function(results) {
    //console.log(results[0]);
    var parsedResults = _.map(results, function(result:any) {
      result.qcdrEvalResult = result.qcdrEvalResult != null ? JSON.parse(result.qcdrEvalResult) : null;
      result.qcdrEvalResultProjected = result.qcdrEvalResultProjected != null ? JSON.parse(result.qcdrEvalResultProjected) : null;
      // It seems that an old version of the logic sometimes double serialized the string. So we detect if the initial
      // JSON parse returns a single string, and if so we parse it again.
      if(_.isString(result.qcdrEvalResult)) {
        result.qcdrEvalResult = JSON.parse(result.qcdrEvalResult);
      }

      if(_.isString(result.qcdrEvalResultProjected)) {
        result.qcdrEvalResultProjected = JSON.parse(result.qcdrEvalResultProjected);
      }

      var anesProviders = [];
      if(result.anesProviders) {
        var providerStrings = result.anesProviders.split(',');
        providerStrings.forEach((providerString) => {
          var providerStringParts = providerString.split('|');
          anesProviders.push({
            providerId: providerStringParts[0],
            providerType: providerStringParts[1],
            providerName: providerStringParts[2],
          })
        })
      }

      if(result.surgeonProvider) {
        var surgeonParts = result.surgeonProvider.split('|');
        result.surgeonProvider = {
          providerId: surgeonParts[0],
          providerName: surgeonParts[1],
          providerType: 'SURGEON'
        }
      }

      if(result.importResult) {
        result.importResult = JSON.parse(result.importResult);
      }

      result.anesProviders = anesProviders;
      return result;
    });
    return Promise.resolve(parsedResults);
  });
}

export function getBatchGuidsFor2017MacraForms(orgInternalName, startDate, endDate) {
  var query =
    `WITH cases AS (
     SELECT f.fac_id,
            e.enctr_id,
            efs.enctr_form_id,
            efs.proc_dt,
            efs.import_result
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
      WHERE efs.proc_dt BETWEEN :startDate AND :endDate
        AND efs.import_result IS NOT NULL
  )
  SELECT import_result AS "importResult"
    FROM cases`;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      startDate: startDate,
      endDate: endDate
    }
  };

  if (!orgInternalName)
    throw new Error('Missing parameter orgInternalName.');

  return orgModels.query(orgInternalName, query, queryOptions)
  .then(function(results) {
    var parsedImportResults = _.map(results, function(result:any) {
      if(result.importResult) {
        result.importResult = JSON.parse(result.importResult);
      }
      return result;
    });

    var sortedResults = _.sortBy(parsedImportResults, (result) => { return result.importResult.importedAt; });
    var importBatchGuids = _.uniq(_.map(sortedResults, (result:any) => result.importResult.importBatchGuid));

    return Promise.resolve(importBatchGuids);
  });
}

export function getFacilityOverviewByDateRange(orgInternalName, facilityId, startDate, endDate) {

  var query = `
WITH dtl AS (
   SELECT f.org_id,
          f.fac_id,
          ef.enctr_form_id,
          e.enctr_id,
          ps.page_id,
          ps.page_nm,
          ps.page_no,
          psd.prop_seq AS anes_prvr_seq,
          MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_typ'::text THEN psd.prop_val ELSE NULL END) AS anes_prvr_typ,
          MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id,
          MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_dt_asmd_care'::text THEN psd.prop_val::DATE ELSE NULL::DATE END) AS anes_prvr_st_dt,
          MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_tm_asmd_care'::text THEN psd.prop_val::TIME ELSE NULL::TIME END) AS anes_prvr_st_tm
     FROM page_surgery_dtl psd
     JOIN page_surgery ps
       ON ps.page_id = psd.page_id
     JOIN enctr_form ef
       ON ef.enctr_form_id = ps.enctr_form_id
      AND ef.void_ind = FALSE
     JOIN enctr e
       ON e.enctr_id = ef.enctr_id
      AND e.purged_ind = FALSE
     JOIN fac f
       ON f.fac_id = e.fac_id
    WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id,anes_prvr_typ,anes_prvr_dt_asmd_care,anes_prvr_tm_asmd_care}'::text[]))
    GROUP BY f.org_id,
             f.fac_id,
             ef.enctr_form_id,
             e.enctr_id,ps.page_id,
             ps.page_nm,
             ps.page_no,
             psd.prop_seq
),
efs AS (
   SELECT efs.enctr_form_id,
          efs.proc_dt,
          efs.anes_st_dt,
          efs.anes_st_tm
     FROM enctr_form_surgery efs
     JOIN enctr_form ef
       ON ef.enctr_form_id = efs.enctr_form_id
      AND ef.void_ind = FALSE
     JOIN enctr e
       ON e.enctr_id = ef.enctr_id
     JOIN fac f
       ON f.fac_id = e.fac_id
),
anes_prvrs AS (
   SELECT org_id,
          fac_id,
          enctr_form_id,
          anes_prvr_typ,
          /* introduce a normalized sequence number to eliminate duplicates */
          ROW_NUMBER() OVER (PARTITION BY org_id,fac_id,enctr_form_id ORDER BY org_id, fac_id, enctr_form_id, anes_prvr_seq, anes_prvr_st_dt, anes_prvr_st_tm NULLS LAST) AS anes_prvr_seq,
          anes_prvr_id,
          anes_prvr_nm
     FROM (SELECT DISTINCT
                  f.org_id,
                  f.fac_id,
                  efs.enctr_form_id,
                  anes_prvr_typ,
                  anes_prvr_seq,
                  anes_prvr_id,
                  COALESCE(SUBSTR(REGEXP_REPLACE(p.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(p.natl_prvr_id,5),'UNKNOWN') AS anes_prvr_nm,
                  COALESCE(dttms.anes_prvr_st_dt,COALESCE(efs.anes_st_dt,efs.proc_dt)) AS anes_prvr_st_dt,
                  COALESCE(dttms.anes_prvr_st_tm,efs.anes_st_tm) AS anes_prvr_st_tm
             FROM efs
             JOIN dtl dttms
               ON dttms.enctr_form_id = efs.enctr_form_id
             JOIN prvr p
               ON p.prvr_id = dttms.anes_prvr_id
             JOIN fac f
               ON f.fac_id = p.fac_id
            WHERE anes_prvr_seq <= 6
              AND anes_prvr_id IS NOT NULL) prvrs
),
anes_staff AS (
   SELECT org_id,
          fac_id,
          enctr_form_id,
          ARRAY_AGG(anes_prvr_id||'|'||anes_prvr_typ||'|'||anes_prvr_nm) AS anes_prvrs_list
     FROM anes_prvrs
    GROUP BY org_id,
             fac_id,
             enctr_form_id
)
SELECT f.fac_id,
       e.enctr_id,
       e.enctr_no AS enctr_enctr_no,
       efs.enctr_form_id,
       efs.proc_dt,
       COALESCE(efs.anes_st_dt,efs.proc_dt) AS anes_st_dt,
       efs.anes_st_tm,
       COALESCE(efs.anes_end_dt,efs.proc_end_dt,efs.proc_dt) AS anes_end_dt,
       efs.anes_end_tm,
       efs.qcdr_eval_result,
       efs.qcdr_missing_data_count,
       efs.qcdr_eval_dttm,
       efs.qcdr_domain_count,
       efs.qcdr_measure_count,
       efs.import_result,
       (surgn.prvr_id||'|'||COALESCE(SUBSTR(REGEXP_REPLACE(surgn.last_nm,'\\W+','','g'),1,10)||'-'||RIGHT(surgn.natl_prvr_id,5),'UNKNOWN')) AS surgn_prvr,
       ARRAY_TO_STRING(anes_staff.anes_prvrs_list,',') AS anes_prvrs
  FROM fac f
  JOIN enctr e
    ON e.fac_id = f.fac_id
   AND e.purged_ind IS DISTINCT FROM TRUE
  JOIN enctr_form ef
    ON ef.enctr_id = e.enctr_id
   AND ef.void_ind IS DISTINCT FROM TRUE
  JOIN enctr_form_surgery efs
    ON efs.enctr_form_id = ef.enctr_form_id
  LEFT JOIN anes_staff
    ON anes_staff.org_id = f.org_id
   AND anes_staff.fac_id = f.fac_id
   AND anes_staff.enctr_form_id = ef.enctr_form_id
  LEFT JOIN prvr surgn
    ON surgn.fac_id = e.fac_id
   AND surgn.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT) `;

if(_.isInteger(facilityId)) query += 'WHERE f.fac_id = :facilityId ';

  query +=
  `AND efs.proc_dt BETWEEN :startDate AND :endDate
   AND efs.qcdr_eval_result IS NOT NULL`;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      startDate: startDate,
      endDate: endDate
    }
  };

  if (!orgInternalName)
    throw new Error('Missing parameter orgInternalName.');

  return orgModels.query(orgInternalName, query, queryOptions);
}

interface Get2017EncounterFormPendingQcdrCalculationResult {
    fac_id: number;
    enctr_id: string;
    enctr_enctr_no: string;
    enctr_pat_mrn: string;
    enctr_form_id: string;
    form_cmplt_pct: string;
    form_valid_ind: boolean;
    proc_dt: Date;
    enctr_form_upd_dt: Date;
    enctr_form_upd_tm: string;
    enctr_form_upd_dt_utc: Date;
    enctr_form_upd_tm_utc: string;
    enctr_form_aud_ver: number;
    qcdr_eval_enctr_form_ver: number;
    pat_age_years: number;
    xfer_locn_cd?: any;
    pacu_pain_score_cd: string;
    prim_anes_typ_cd: string;
    asa_clsfn_cd: string;
    asa_emerg_ind: boolean;
    preop_eval_osa_cd: string;
    preop_eval_gerd_cd: string;
    preop_eval_glauc_cd: string;
    preop_eval_ponv_cd: string;
    preop_eval_alctob_cd: string;
    comp_or_ind: boolean;
    all_comp_cnt: number;
    all_comp_list?: any;
    req_data_proc_dt: boolean;
    req_data_surgn_prvr: boolean;
    req_data_anes_prvr: boolean;
    sort_key: string;
    total_count: string;
}

interface Get2018EncounterFormPendingQcdrCalculationResult {
  fac_id: number;
  enctr_id: string;
  enctr_enctr_no: string;
  enctr_pat_mrn: string;
  enctr_form_id: string;
  form_cmplt_pct: string;
  form_valid_ind: boolean;
  proc_dt: Date;
  enctr_form_upd_dt: Date;
  enctr_form_upd_tm: string;
  enctr_form_upd_dt_utc: Date;
  enctr_form_upd_tm_utc: string;
  enctr_form_aud_ver: number;
  qcdr_eval_enctr_form_ver: number;
  pat_age_years: number;
  xfer_locn_cd?: any;
  pacu_pain_score_cd: string;
  prim_anes_typ_cd: string;
  asa_clsfn_cd: string;
  asa_emerg_ind: boolean;
  preop_eval_osa_cd: string;
  preop_eval_gerd_cd: string;
  preop_eval_glauc_cd: string;
  preop_eval_ponv_cd: string;
  preop_eval_alctob_cd: string;
  comp_or_ind: boolean;
  all_comp_cnt: number;
  all_comp_list?: any;
  req_data_proc_dt: boolean;
  req_data_surgn_prvr: boolean;
  req_data_anes_prvr: boolean;
  sort_key: string;
  total_count: string;
}

export interface FormQcdrSubmissionUpdate {
  encounterFormId:number,
  submittedEncounterFormVersion:number,
  qcdrCaseId:string
}

export interface FormQcdrResultUpdate {
  encounterFormId:number,
  qcdrResults:string,
  qcdrResultsProjected?: string,
  qcdrEvalDateTime:string,
  qcdrMissingDataCount:number,
  qcdrEvalEncounterFormVersion:number
}

export async function setFormQcdrSubmissionResults(orgInternalName:string, orgUserId:number, updates:FormQcdrSubmissionUpdate[] ):Promise<boolean> {

  if(updates.length > 100) {
    throw new Error('Cannot submit more than 100 updates in a given batch.');
  }

  let connection = await <{transaction:Transaction, connection:Sequelize}>orgModels.createOrgUserTransaction(orgInternalName, orgUserId);

  for(let update of updates) {

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
      transaction: connection.transaction
    }
    let queryResult = await connection.connection.query(query,options);
  }

  let commitResult = await connection.transaction.commit();
  return true;
}

export async function setFormQcdrResults(orgInternalName:string, orgUserId:number, updates:FormQcdrResultUpdate[] ):Promise<boolean> {

  if(updates.length > 100) {
    throw new Error('Cannot submit more than 100 updates in a given batch.');
  }

  let connection = await <{transaction:Transaction, connection:Sequelize}>orgModels.createOrgUserTransaction(orgInternalName, orgUserId);

  for(let update of updates) {
    let parsedDateTime = moment(update.qcdrEvalDateTime,moment.ISO_8601);

    if(!parsedDateTime.isValid()) {
      throw new Error('QCDR evaluation date time is not in supported ISO 8601 format.');
    }

    let query = `UPDATE enctr_form_surgery
                    SET qcdr_eval_result = :qcdrEvalResult,
                        qcdr_eval_result_projected = :qcdrEvalResultProjected,
                        qcdr_missing_data_count = :qcdrMissingDataCount,
                        qcdr_eval_dttm = :qcdrEvalDttm,
                        qcdr_eval_enctr_form_ver = :qcdrEvalEnctrFormVer
                  WHERE enctr_form_id = :enctrFormId;`
    let options = <QueryOptions>{
      type: QueryTypes.RAW,
      replacements: {
        qcdrEvalResult: update.qcdrResults,
        qcdrEvalResultProjected: update.qcdrResultsProjected,
        qcdrMissingDataCount: update.qcdrMissingDataCount,
        qcdrEvalDttm: parsedDateTime.toISOString(),
        qcdrEvalEnctrFormVer: update.qcdrEvalEncounterFormVersion,
        enctrFormId: update.encounterFormId
      },
      transaction: connection.transaction
    }
    let queryResult = await connection.connection.query(query,options);
  }

  let commitResult = await connection.transaction.commit();
  return true;
}

interface GetUnsubmittedAbgCasesParams {
  orgInternalName: string;
  facilityId: number;
  startDate: string;
  endDate: string;
}

// For now we are using a legacy naming convention so that it matches
// the existing search definition. In the future we should migrate this to
// appropriate camel case.
interface UnsubmittedAbgCase {
  fac_id: number,
  enctr_id: number,
  enctr_enctr_no: number,
  enctr_form_id: number,
  proc_dt: string,
  surgn_prvr_npi: string,
  anes_prvrs_array: string,
  qcdr_eval_result: string,
  anes_st_dt: string,
  anes_st_tm: string,
  anes_end_dt: string,
  anes_end_tm: string,
  anes_typ_cd: string,
  asa_clsfn_cd: string,
  pat_age_years: number,
  pat_gender_cd: string,
  qcdr_subm_case_id: string,
  qcdr_eval_enctr_form_ver: number,
  qcdr_subm_enctr_form_ver: number
}

export async function getUnsubmittedAbgCases(params:GetUnsubmittedAbgCasesParams):Promise<UnsubmittedAbgCase[]> {
  let query = `
  WITH cases AS ( /* class@PQRSAnalyticsDAO.getUnsubmittedAbgCases */
    SELECT f.org_id,
           f.fac_id,
           e.enctr_id,
           e.enctr_no AS enctr_enctr_no,
           efs.enctr_form_id,
           efs.proc_dt,
           CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
           efs.qcdr_eval_result,
           COALESCE(efs.anes_st_dt,efs.proc_dt) AS anes_st_dt,
           efs.anes_st_tm,
           COALESCE(efs.anes_end_dt,efs.proc_end_dt,efs.proc_dt) AS anes_end_dt,
           efs.anes_end_tm,
           CASE COALESCE(efs.prim_anes_typ_cd,'U')
              WHEN 'GENERAL' THEN 'G'
              WHEN 'MAC' THEN 'M'
              WHEN 'REGIONAL' THEN 'B'
              WHEN 'SPINAL' THEN 'S'
              WHEN 'EPIDURAL' THEN 'E'
              WHEN 'LABOR_EPIDURAL' THEN 'E'
              WHEN 'LOCAL' THEN 'B'
              WHEN 'TOPICAL' THEN 'B'
              ELSE 'U'
           END AS anes_typ_cd,
           CASE
              WHEN efs.asa_emerg_ind IS NOT NULL AND
                   efs.asa_emerg_ind = TRUE THEN efs.asa_clsfn_cd||'E'
              ELSE efs.asa_clsfn_cd
           END AS asa_clsfn_cd,
           CASE
              WHEN COALESCE(e.pat_dob,efs.pat_dob) IS NOT NULL THEN
                 ROUND(CAST((EXTRACT(year FROM AGE(efs.proc_dt,COALESCE(e.pat_dob,efs.pat_dob)))*12 + EXTRACT(month FROM AGE(efs.proc_dt,COALESCE(e.pat_dob,efs.pat_dob))))/12 AS NUMERIC))
              WHEN efs.pat_age_txt IS NOT NULL THEN
                 CAST(SUBSTRING(efs.pat_age_txt,'(\d+)') AS NUMERIC)
           END AS pat_age_years,
           CASE UPPER(SUBSTR(COALESCE(efs.pat_gender_cd,e.pat_gender_cd,'UNKNOWN'),1,1))
              WHEN 'M' THEN 'M'
              WHEN 'F' THEN 'F'
              ELSE 'U'
           END AS pat_gender_cd,
           efs.qcdr_subm_case_id,
           efs.qcdr_eval_enctr_form_ver,
           efs.qcdr_subm_enctr_form_ver
      FROM fac f
      JOIN enctr e
        ON e.fac_id = f.fac_id
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN enctr_form ef
        ON ef.enctr_id = e.enctr_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
      JOIN enctr_form_surgery efs
        ON efs.enctr_form_id = ef.enctr_form_id
           /* this is the key filter for the query since it identifies those cases that need to be submitted */
       AND efs.qcdr_eval_enctr_form_ver > efs.qcdr_subm_enctr_form_ver
           /* filter out LABOR_EPIDURAL cases  - removing this filter for 2019 submissions */
       -- AND efs.prim_anes_typ_cd <> 'LABOR_EPIDURAL'
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
     WHERE f.fac_id = :facilityId
       AND efs.proc_dt BETWEEN :startDate AND :endDate
 ),
 anes_staff AS (
    SELECT org_id,
           fac_id,
           enctr_form_id,
           ARRAY_AGG(CASE WHEN anes_prvr_typ = 'MDA' THEN natl_prvr_id||'|'||'A' ELSE natl_prvr_id||'|'|| 'C' END) AS anes_prvrs_typs
      FROM (SELECT anes_prvrs.org_id,
                   anes_prvrs.fac_id,
                   anes_prvrs.enctr_form_id,
                   anes_prvrs.anes_prvr_typ,
                   COALESCE(p.natl_prvr_id,'NPIMISSING') AS natl_prvr_id
              FROM rpt_enctr_form_anes_prvr_list_v anes_prvrs
              JOIN cases c
                ON c.fac_id = anes_prvrs.fac_id
               AND c.enctr_form_id = anes_prvrs.enctr_form_id
              JOIN prvr p
                ON p.fac_id = anes_prvrs.fac_id
               AND p.prvr_id = anes_prvrs.anes_prvr_id) anes_staff
     GROUP BY org_id,
              fac_id,
              enctr_form_id
 )
 SELECT cases.fac_id,
        cases.enctr_id,
        cases.enctr_enctr_no,
        cases.enctr_form_id,
        cases.proc_dt,
        COALESCE(surgn.natl_prvr_id,'NA') AS surgn_prvr_npi,
        ARRAY_TO_STRING((SELECT array_agg(a) FROM UNNEST(anes_staff.anes_prvrs_typs) a WHERE a IS NOT NULL),',') AS anes_prvrs_array,
        cases.qcdr_eval_result,
        cases.anes_st_dt,
        cases.anes_st_tm,
        cases.anes_end_dt,
        cases.anes_end_tm,
        cases.anes_typ_cd,
        cases.asa_clsfn_cd,
        cases.pat_age_years,
        cases.pat_gender_cd,
        cases.qcdr_subm_case_id,
        cases.qcdr_eval_enctr_form_ver,
        cases.qcdr_subm_enctr_form_ver
   FROM cases
   JOIN anes_staff
     ON anes_staff.org_id = cases.org_id
    AND anes_staff.fac_id = cases.fac_id
    AND anes_staff.enctr_form_id = cases.enctr_form_id
   /* Surgeon - outer joining since a surgeon is no longer required (e.g. radiology and MRI cases) */
   LEFT JOIN prvr surgn
     ON surgn.fac_id = cases.fac_id
    AND surgn.prvr_id = cases.surgn_prvr_id`;

  let queryOptions:QueryOptions = {
      type: QueryTypes.SELECT,
      replacements: {
        startDate: params.startDate,
        endDate: params.endDate,
        facilityId: params.facilityId
      }
  }

  let cases = await orgModels.query(params.orgInternalName, query, queryOptions);
  return cases;
}

export async function get2017QcdrFormFacts(orgInternalName:string, facilityId:number, onlyFormsPendingCalculation:boolean = true):Promise<Get2017EncounterFormPendingQcdrCalculationResult[]> {
  var query = `
  SELECT /* facility */
         e.fac_id                       AS fac_id,
         /* encounter */
         e.enctr_id                     AS enctr_id,
         e.enctr_no                     AS enctr_enctr_no,
         e.pat_mrn                      AS enctr_pat_mrn,
         ef.enctr_form_id               AS enctr_form_id,
         ef.form_cmplt_pct              AS form_cmplt_pct,
         ef.form_valid_ind              AS form_valid_ind,
         efs.proc_dt                    AS proc_dt,
         DATE(ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(utl_get_fac_id_for_enctr_id(ef.enctr_id),'facTimeZone'),'UTC')) AS enctr_form_upd_dt,
         CAST(ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(utl_get_fac_id_for_enctr_id(ef.enctr_id),'facTimeZone'),'UTC') AS TIME) AS enctr_form_upd_tm,
         DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
         CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
         efs.aud_ver                    AS enctr_form_aud_ver,
         efs.qcdr_eval_enctr_form_ver   AS qcdr_eval_enctr_form_ver,
         /* data used for ABG metric evaulation */
         CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
         efs.xfer_locn_cd               AS xfer_locn_cd,
         efs.pacu_pain_score_cd         AS pacu_pain_score_cd,
         efs.prim_anes_typ_cd           AS prim_anes_typ_cd,
         efs.asa_clsfn_cd               AS asa_clsfn_cd,
         efs.asa_emerg_ind              AS asa_emerg_ind,
         efs.preop_eval_osa_cd          AS preop_eval_osa_cd,
         efs.preop_eval_gerd_cd         AS preop_eval_gerd_cd,
         efs.preop_eval_glauc_cd        AS preop_eval_glauc_cd,
         efs.preop_eval_ponv_cd         AS preop_eval_ponv_cd,
         efs.preop_eval_alctob_cd       AS preop_eval_alctob_cd,
         efs.comp_or_ind                AS comp_or_ind,
         COALESCE(ARRAY_LENGTH(all_comps.comp_list,1),0) AS all_comp_cnt,
         all_comps.comp_list            AS all_comp_list,
         /* data required for ABG case submission */
         CASE
            WHEN efs.proc_dt IS NOT NULL THEN TRUE
            ELSE FALSE
         END                            AS req_data_proc_dt,
         CASE
            WHEN efs.surgn_prvr_id IS NOT NULL THEN TRUE
            ELSE FALSE
         END                            AS req_data_surgn_prvr,
         CASE
            WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
            ELSE FALSE
         END                            AS req_data_anes_prvr,
         COALESCE(p.natl_prvr_id,'UNKNOWN') AS surgn_prvr_npi,
         anes_prvrs.anes_prvrs_list     AS anes_prvrs_list,
         efs.import_result              AS import_result,
         /* search metadata */
         ROW_NUMBER() OVER (ORDER BY e.fac_id, e.enctr_id, ef.enctr_form_id) AS sort_key,
         COUNT(*) OVER()                AS total_count
    FROM enctr e
    /* only encounters associated with at least one form */
    JOIN enctr_form ef
      ON ef.enctr_id = e.enctr_id
    /* only non-voided forms */
     AND ef.void_ind = FALSE
    JOIN form_defn fd
      ON fd.form_defn_id = ef.form_defn_id
     AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- do not incude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
    JOIN enctr_form_surgery efs
      ON efs.enctr_form_id = ef.enctr_form_id
     AND efs.proc_dt BETWEEN '2017-01-01' AND '2017-12-31'
    /* exclude forms without the base data requirements */
     AND efs.proc_dt IS NOT NULL`;

    if(onlyFormsPendingCalculation) {
      query += `
    /* only include forms needing updated QCDR results */
    AND COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver
      `;
    }

    query += `
    LEFT JOIN (SELECT fac_id, enctr_form_id, ARRAY_AGG(comp_nm) AS comp_list
                 FROM rpt_comp_pivot_v
                WHERE comp_ind = 1
                GROUP BY fac_id, enctr_form_id) all_comps
      ON all_comps.fac_id = e.fac_id
     AND all_comps.enctr_form_id = ef.enctr_form_id

     LEFT JOIN (SELECT fac_id,
                       enctr_form_id,
                       ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
                       COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
                  FROM (SELECT p.fac_id,
                               ef.enctr_form_id,
                               p.natl_prvr_id AS anes_prvr_npi
                          FROM page_surgery_dtl psd
                          JOIN page_surgery ps
                            ON ps.page_id = psd.page_id
                          JOIN enctr_form ef
                            ON ef.enctr_form_id = ps.enctr_form_id
                           AND ef.void_ind = FALSE
                          JOIN prvr p
                            ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
                         WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
                           AND psd.prop_val IS NOT NULL) anes_staff
                 GROUP BY fac_id,
                          enctr_form_id) anes_prvrs
      ON anes_prvrs.fac_id = e.fac_id
     AND anes_prvrs.enctr_form_id = ef.enctr_form_id
    LEFT JOIN prvr p
      ON p.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
  WHERE e.fac_id = :facilityId
    `;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId
    }
  };

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  let queryResult = await orgModels.query(orgInternalName, query, queryOptions);
  return <Get2017EncounterFormPendingQcdrCalculationResult[]> queryResult;
}


export async function get2018QcdrFormFacts(orgInternalName:string, facilityId:number, onlyFormsPendingCalculation:boolean = true):Promise<Get2018EncounterFormPendingQcdrCalculationResult[]> {
  var query = `
  SELECT /* facility */
         e.fac_id                       AS fac_id,
         /* encounter */
         e.enctr_id                     AS enctr_id,
         e.enctr_no                     AS enctr_enctr_no,
         e.pat_mrn                      AS enctr_pat_mrn,
         ef.enctr_form_id               AS enctr_form_id,
         ef.form_cmplt_pct              AS form_cmplt_pct,
         ef.form_valid_ind              AS form_valid_ind,
         efs.proc_dt                    AS proc_dt,
         DATE(ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(utl_get_fac_id_for_enctr_id(ef.enctr_id),'facTimeZone'),'UTC')) AS enctr_form_upd_dt,
         CAST(ef.upd_dttm AT TIME ZONE COALESCE(utl_get_fac_opt(utl_get_fac_id_for_enctr_id(ef.enctr_id),'facTimeZone'),'UTC') AS TIME) AS enctr_form_upd_tm,
         DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
         CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
         efs.aud_ver                    AS enctr_form_aud_ver,
         efs.qcdr_eval_enctr_form_ver   AS qcdr_eval_enctr_form_ver,
         /* data used for ABG metric evaulation */
         CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
         efs.xfer_locn_cd               AS xfer_locn_cd,
         efs.pacu_pain_score_cd         AS pacu_pain_score_cd,
         efs.prim_anes_typ_cd           AS prim_anes_typ_cd,
         efs.asa_clsfn_cd               AS asa_clsfn_cd,
         efs.asa_emerg_ind              AS asa_emerg_ind,
         efs.preop_eval_osa_cd          AS preop_eval_osa_cd,
         efs.preop_eval_gerd_cd         AS preop_eval_gerd_cd,
         efs.preop_eval_glauc_cd        AS preop_eval_glauc_cd,
         efs.preop_eval_ponv_cd         AS preop_eval_ponv_cd,
         efs.preop_eval_alctob_cd       AS preop_eval_alctob_cd,
         efs.comp_or_ind                AS comp_or_ind,
         COALESCE(ARRAY_LENGTH(all_comps.comp_list,1),0) AS all_comp_cnt,
         all_comps.comp_list            AS all_comp_list,
         /* data required for ABG case submission */
         CASE
            WHEN efs.proc_dt IS NOT NULL THEN TRUE
            ELSE FALSE
         END                            AS req_data_proc_dt,
         CASE
            WHEN efs.surgn_prvr_id IS NOT NULL THEN TRUE
            ELSE FALSE
         END                            AS req_data_surgn_prvr,
         CASE
            WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
            ELSE FALSE
         END                            AS req_data_anes_prvr,
         COALESCE(p.natl_prvr_id,'UNKNOWN') AS surgn_prvr_npi,
         anes_prvrs.anes_prvrs_list     AS anes_prvrs_list,
         efs.import_result              AS import_result,
         /* search metadata */
         ROW_NUMBER() OVER (ORDER BY e.fac_id, e.enctr_id, ef.enctr_form_id) AS sort_key,
         COUNT(*) OVER()                AS total_count
    FROM enctr e
    /* only encounters associated with at least one form */
    JOIN enctr_form ef
      ON ef.enctr_id = e.enctr_id
    /* only non-voided forms */
     AND ef.void_ind = FALSE
    JOIN form_defn fd
      ON fd.form_defn_id = ef.form_defn_id
     AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- do not incude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
    JOIN enctr_form_surgery efs
      ON efs.enctr_form_id = ef.enctr_form_id
     AND efs.proc_dt BETWEEN '2018-01-01' AND '2018-12-31'
    /* exclude forms without the base data requirements */
     AND efs.proc_dt IS NOT NULL`;

    if(onlyFormsPendingCalculation) {
      query += `
    /* only include forms needing updated QCDR results */
    AND COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver
      `;
    }

    query += `
    LEFT JOIN (SELECT fac_id, enctr_form_id, ARRAY_AGG(comp_nm) AS comp_list
                 FROM rpt_comp_pivot_v
                WHERE comp_ind = 1
                GROUP BY fac_id, enctr_form_id) all_comps
      ON all_comps.fac_id = e.fac_id
     AND all_comps.enctr_form_id = ef.enctr_form_id

     LEFT JOIN (SELECT fac_id,
                       enctr_form_id,
                       ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
                       COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
                  FROM (SELECT p.fac_id,
                               ef.enctr_form_id,
                               p.natl_prvr_id AS anes_prvr_npi
                          FROM page_surgery_dtl psd
                          JOIN page_surgery ps
                            ON ps.page_id = psd.page_id
                          JOIN enctr_form ef
                            ON ef.enctr_form_id = ps.enctr_form_id
                           AND ef.void_ind = FALSE
                          JOIN prvr p
                            ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
                         WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
                           AND psd.prop_val IS NOT NULL) anes_staff
                 GROUP BY fac_id,
                          enctr_form_id) anes_prvrs
      ON anes_prvrs.fac_id = e.fac_id
     AND anes_prvrs.enctr_form_id = ef.enctr_form_id
    LEFT JOIN prvr p
      ON p.prvr_id = CAST(efs.surgn_prvr_id AS BIGINT)
  WHERE e.fac_id = :facilityId
    `;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId
    }
  };

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  let queryResult = await orgModels.query(orgInternalName, query, queryOptions);
  return <Get2018EncounterFormPendingQcdrCalculationResult[]> queryResult;
}

export interface Get2019EncounterFormPendingQcdrCalculationResult {
  facilityId: number;
  encounterFormId: string;
  enctrNo: string;
  enctrPatMrn: string;
  formCmpltPct: string;
  formValidInd: boolean;
  enctrFormUpdDtUtc: Date;
  enctrFormUpdTmUtc: string;
  enctrFormAudVer: number;
  qcdrEvalEnctrFormVer: number;
  dateOfService: Date;
  patAgeYears: number;
  painScoreCd: string;
  xferLocnCd: string;
  caseCancelledInd: boolean;
  asaClsfnCd: string;
  asaEmergInd: boolean;
  difficultAirwayInd: boolean;
  plannedAirwayEquipUsedInd: boolean;
  preopEvalPonvCd: string;
  preopEvalGerdCd: string;
  preopEvalAlchDrugCd: string;
  compOrInd: boolean;
  anesStartTime: string;
  caseCancelledStgCd: string;
  multiModalPainMgmtCd: string;
  priorOsaDiagInd: boolean;
  patIncapacitatedInd : boolean;
  preopEvalOsaPosInd: boolean;
  osaEducationInd: boolean;
  nmbNdAdminInd: boolean;
  patRemainedIntubPostopInd: boolean;
  nmbAssessmtPerfInd: boolean;
  nmbNdRevAdminInd: boolean;
  nmbNdExtubTmRqrmtInd: boolean;
  nmbNdRevSuffcntInd: boolean;
  osaMitigationUsedInd: boolean;
  patSmokeInd: boolean;
  patSmokeCessInd: boolean;
  patSmokeDosInd: boolean;
  maintInhAgentUsedInd: boolean;
  ponvHighRiskInd: boolean;
  combTherCd: string;
  importResult: any;
  hasDateOfService: boolean;
  hasAnesthesiaProvider: boolean;
  surgeonNpi: string;
  anesProvidersList: any;
  allCptCodes: any;
  allCptCnt: number;
  compList: any;
  compCnt: number;
  postDischStatusAssessedCd: string;
  primaryAnesthetic: string;
  anesthesiaStartDateTime: Date;
  anesthesiaEndDateTime: Date;
  patientBodyTemp: number;
  nerveBlockInd: boolean;
}

export async function get2019QcdrFormFacts(orgInternalName:string, facilityId:number, currentEvalEngineVersion:string, onlyFormsPendingCalculation:boolean = true, encounterFormId?:number):Promise<Get2019EncounterFormPendingQcdrCalculationResult[]>
{
  var query = `
WITH cases AS ( /* class@PQRSAnalyticsDAO.get2019QcdrFormFacts */
   SELECT e.fac_id,
          ef.enctr_form_id,
          e.enctr_no,
          e.pat_mrn AS enctr_pat_mrn,
          ef.form_cmplt_pct,
          ef.form_valid_ind,
          DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
          CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
          efs.aud_ver AS enctr_form_aud_ver,
          efs.qcdr_eval_enctr_form_ver,
          efs.proc_dt,
          CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
          CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
          efs.pacu_pain_score_cd,
          efs.prim_anes_typ_cd,
          efs.preop_eval_osa_cd,
          efs.preop_eval_gerd_cd,
          efs.preop_eval_glauc_cd,
          efs.preop_eval_ponv_cd,
          efs.preop_eval_alctob_cd,
          efs.xfer_locn_cd,
          COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
          efs.asa_clsfn_cd,
          efs.asa_emerg_ind,
          efs.difficult_airway_ind,
          efs.planned_airway_equip_used_ind,
          efs.comp_or_ind,
          efs.anes_st_tm,
          efs.case_cancelled_stg_cd,
          efs.multi_modal_pain_mgmt_cd,
          efs.prior_osa_diag_ind,
          efs.pat_incapacitated_ind ,
          efs.preop_eval_osa_pos_ind,
          efs.osa_education_ind,
          efs.nmb_nd_admin_ind,
          efs.pat_remained_intub_postop_ind,
          efs.nmb_assessmt_perf_ind,
          efs.nmb_nd_rev_admin_ind,
          efs.nmb_nd_extub_tm_rqrmt_ind,
          efs.nmb_nd_rev_suffcnt_ind,
          efs.osa_mitigation_used_ind,
          efs.pat_smoke_ind,
          efs.pat_smoke_cess_ind,
          efs.pat_smoke_dos_ind,
          efs.maint_inh_agent_used_ind,
          efs.ponv_high_risk_ind,
          efs.comb_ther_cd,
          efs.post_disch_status_assessed_cd,
          (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
          (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
          CASE
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                -- treat value as Fahrenheit and convert to Celsius
                ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                -- treat value as Celsius
                efs.pat_body_temp
             ELSE NULL
          END AS pat_body_temp,
          efs.import_result
     FROM enctr e
     JOIN enctr_form ef
       ON ef.enctr_id = e.enctr_id
      AND ef.void_ind IS NOT DISTINCT FROM FALSE
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
     JOIN enctr_form_surgery efs
       ON efs.enctr_form_id = ef.enctr_form_id
    WHERE e.fac_id = :facilityId
      AND efs.proc_dt IS NOT NULL
      AND efs.proc_dt BETWEEN '2019-01-01' AND '2019-12-31'
  `;
  if(onlyFormsPendingCalculation) {
    query += `
      /* only include forms needing updated QCDR results */
      AND (COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
           COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion)
    `;
  }

  if(encounterFormId) {
    query += `
      /* only a specific encounter form */
      AND ef.enctr_form_id = :encounterFormId
    `;
  }

  query += `
),
comps AS (
   SELECT c.fac_id,
          c.enctr_form_id,
          ARRAY_AGG(comp_nm) AS comp_list
     FROM rpt_comp_pivot_v v
     JOIN cases c
       ON c.fac_id = v.fac_id
      AND c.enctr_form_id = v.enctr_form_id
    WHERE comp_ind = 1
    GROUP BY c.fac_id,
             c.enctr_form_id
),
cpts AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
          COUNT(DISTINCT cpt_cd) AS cpt_cnt
     FROM (SELECT c.fac_id,
                  c.enctr_form_id,
                  psd.prop_val AS cpt_cd
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) cpt_list
    GROUP BY fac_id,
             enctr_form_id
),
nerve_blocks AS (
    SELECT fac_id,
           enctr_form_id,
           COUNT(*) AS cpt_cnt
      FROM (SELECT c.fac_id,
                   c.enctr_form_id,
                   psd.prop_val AS cpt_cd
              FROM page_surgery_dtl psd
              JOIN page_surgery ps
                ON ps.page_id = psd.page_id
              JOIN cases c
                ON c.enctr_form_id = ps.enctr_form_id
             WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
               AND psd.prop_seq IN (4,5)
               AND psd.prop_val IS NOT NULL) cpt_list
     GROUP BY fac_id,
              enctr_form_id
),
anes_prvrs AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
          COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
     FROM (SELECT p.fac_id,
                  c.enctr_form_id,
                  p.natl_prvr_id AS anes_prvr_npi
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
             JOIN prvr p
               ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) anes_staff
    GROUP BY fac_id,
             enctr_form_id
)
SELECT cases.fac_id                                      AS "facilityId",
       cases.enctr_form_id                               AS "encounterFormId",
       enctr_no                                          AS "enctrNo",
       enctr_pat_mrn                                     AS "enctrPatMrn",
       form_cmplt_pct                                    AS "formCmpltPct",
       form_valid_ind                                    AS "formValidInd",
       enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
       enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
       enctr_form_aud_ver                                AS "enctrFormAudVer",
       qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
       proc_dt                                           AS "dateOfService",
       pat_age_years                                     AS "patAgeYears",
       pacu_pain_score_cd                                AS "painScoreCd",
       xfer_locn_cd                                      AS "xferLocnCd",
       case_cancelled_ind                                AS "caseCancelledInd",
       asa_clsfn_cd                                      AS "asaClsfnCd",
       cases.asa_emerg_ind                               AS "asaEmergInd",
       difficult_airway_ind                              AS "difficultAirwayInd",
       planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
       preop_eval_ponv_cd                                AS "preopEvalPonvCd",
       preop_eval_gerd_cd                                AS "preopEvalGerdCd",
       preop_eval_alctob_cd                              AS "preopEvalAlchDrugCd",
       comp_or_ind                                       AS "compOrInd",
       anes_st_tm                                        AS "anesStartTime",
       case_cancelled_stg_cd                             AS "caseCancelledStgCd",
       multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
       prior_osa_diag_ind                                AS "priorOsaDiagInd",
       pat_incapacitated_ind                             AS "patIncapacitatedInd",
       preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
       osa_education_ind                                 AS "osaEducationInd",
       nmb_nd_admin_ind                                  AS "nmbNdAdminInd",
       pat_remained_intub_postop_ind                     AS "patRemainedIntubPostopInd",
       nmb_assessmt_perf_ind                             AS "nmbAssessmtPerfInd",
       nmb_nd_rev_admin_ind                              AS "nmbNdRevAdminInd",
       nmb_nd_extub_tm_rqrmt_ind                         AS "nmbNdExtubTmRqrmtInd",
       nmb_nd_rev_suffcnt_ind                            AS "nmbNdRevSuffcntInd",
       osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
       pat_smoke_ind                                     AS "patSmokeInd",
       pat_smoke_cess_ind                                AS "patSmokeCessInd",
       pat_smoke_dos_ind                                 AS "patSmokeDosInd",
       maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
       ponv_high_risk_ind                                AS "ponvHighRiskInd",
       comb_ther_cd                                      AS "combTherCd",
       import_result                                     AS "importResult",
       CASE
          WHEN proc_dt IS NOT NULL THEN TRUE
          ELSE FALSE
       END                                               AS "hasDateOfService",
       CASE
          WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
          ELSE FALSE
       END                                               AS "hasAnesthesiaProvider",
       COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
       anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
       cpts.cpt_list                                     AS "allCptCodes",
       COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
       comps.comp_list                                   AS "compList",
       COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
       post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
       prim_anes_typ_cd                                  AS "primaryAnesthetic",
       anes_st_dttm                                      AS "anesthesiaStartDateTime",
       anes_end_dttm                                     AS "anesthesiaEndDateTime",
       pat_body_temp                                     AS "patientBodyTemp",
       CASE
          WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
               nerve_blocks.cpt_cnt > 0 THEN TRUE
          ELSE FALSE
       END                                               AS "nerveBlockInd"
  FROM cases
  LEFT JOIN comps
    ON comps.fac_id = cases.fac_id
   AND comps.enctr_form_id = cases.enctr_form_id
  LEFT JOIN cpts
    ON cpts.fac_id = cases.fac_id
   AND cpts.enctr_form_id = cases.enctr_form_id
  LEFT JOIN anes_prvrs
    ON anes_prvrs.fac_id = cases.fac_id
   AND anes_prvrs.enctr_form_id = cases.enctr_form_id
  LEFT JOIN prvr surgn
    ON surgn.prvr_id = cases.surgn_prvr_id
  LEFT JOIN nerve_blocks
    ON nerve_blocks.fac_id = cases.fac_id
   AND nerve_blocks.enctr_form_id = cases.enctr_form_id
 `;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      encounterFormId: encounterFormId,
      currentEvalEngineVersion: currentEvalEngineVersion
    }
  };

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  let queryResult = await orgModels.query(orgInternalName, query, queryOptions);
  return <Get2019EncounterFormPendingQcdrCalculationResult[]> queryResult;
}

export interface GetSurveyResponsesForEncounterFormsResult {
    facilityId: number;
    encounterFormId: string
    surveyGuid: string;
    surveyStateCode: string;
    surveySentTimestamp: string;
    surveyResponseReceviedTimestamp: string;
    surveyResponseData: string;
}

export async function GetSurveyResponsesForEncounterForms(orgInternalName:string, facilityId:number, surveyDefinitionCode:string, encounterFormIdList:number[]):Promise<GetSurveyResponsesForEncounterFormsResult[]>
{
  var query = `
  WITH survey_forms AS ( /* class@PQRSAnalyticsDAO.GetSurveyResponsesForEncounterForms */
      SELECT enctr_form_id
        FROM (VALUES`;

  let encounterForms = [];
  encounterForms.push('(-1)');

  for(let encounterFormId of encounterFormIdList) {
      encounterForms.push(['(',encounterFormId,')'].join(""));
  }
  query += encounterForms.join(",");


  query += `) AS x (enctr_form_id)
   ),
   surveys AS (
      SELECT s.facility_id,
             s.related_encounter_form_id,
             s.survey_guid,
             s.response_data,
             ss.survey_state_code,
             s.survey_state_history
        FROM survey s
        JOIN survey_state ss
          ON ss.survey_state_id = s.survey_state_id
         AND ss.survey_state_code IN ('CONTACT_INITIATED','SURVEY_OPENED','SURVEY_STARTED','SURVEY_COMPLETED')
        JOIN survey_definition_history sdh
          ON sdh.survey_definition_history_id = s.survey_definition_history_id
        JOIN survey_definition sd
          ON sd.survey_definition_id = sdh.survey_definition_id
        JOIN survey_forms sf
          ON sf.enctr_form_id = s.related_encounter_form_id
       WHERE s.org_name_internal = :orgNameInternal
         AND s.facility_id = :facilityId
         AND sd.survey_definition_code = :surveyDefinitionCode
   ),
   survey_history AS (
      SELECT s.survey_guid,
             to_timestamp(h."createdAt") state_change_dttm,
             ss_from.survey_state_code AS from_state,
             ss_to.survey_state_code AS to_state
        FROM surveys s,
             jsonb_to_recordset(s.survey_state_history) AS h ("createdAt" BIGINT, "toStateId" INT, "fromStateId" INT)
        JOIN survey_state ss_from
          ON ss_from.survey_state_id = h."fromStateId"
        JOIN survey_state ss_to
          ON ss_to.survey_state_id = h."toStateId"
   ),
   relevant_state_changes AS (
      SELECT survey_guid,
             MAX(CASE
                    WHEN to_state = 'CONTACT_INITIATED' THEN state_change_dttm
                    ELSE NULL
                 END) AS survey_sent_dttm,
             MAX(CASE
                    WHEN to_state = 'SURVEY_COMPLETED' THEN state_change_dttm
                    ELSE NULL
                 END) AS survey_completed_dttm
        FROM survey_history
       GROUP BY survey_guid
       ORDER BY 1, 2, 3 NULLS LAST
   )
   SELECT s.facility_id AS "facilityId",
          s.related_encounter_form_id AS "encounterFormId",
          s.survey_guid AS "surveyGuid",
          s.survey_state_code AS "surveyStateCode",
          rsc.survey_sent_dttm AT TIME ZONE 'US/CENTRAL' AS "surveySentTimestamp",
          rsc.survey_completed_dttm AT TIME ZONE 'US/CENTRAL' AS "surveyResponseReceviedTimestamp",
          s.response_data AS "surveyResponseData"
     FROM surveys s
     JOIN relevant_state_changes rsc
       ON rsc.survey_guid = s.survey_guid`;

  if (!orgInternalName || facilityId === null || !surveyDefinitionCode) {
    throw new Error('Missing parameter orgInternalName, facilityId or surveyDefinitionCode.');
  }

  let connection = await getFrameworkConnection({isReadOnly: true});
  const sql = query.replace(':orgNameInternal', '$1').replace(':facilityId', '$2').replace(':surveyDefinitionCode','$3');
  let queryResult = await connection.query(sql, [orgInternalName,facilityId,surveyDefinitionCode]);
  return <GetSurveyResponsesForEncounterFormsResult[]> queryResult;
}

export interface Get2020EncounterFormPendingQcdrCalculationResult {
  facilityId: number;
  encounterFormId: string;
  enctrNo: string;
  enctrPatMrn: string;
  formCmpltPct: string;
  formValidInd: boolean;
  enctrFormUpdDtUtc: Date;
  enctrFormUpdTmUtc: string;
  enctrFormAudVer: number;
  qcdrEvalEnctrFormVer: number;
  dateOfService: Date;
  patAgeYears: number;
  painScoreCd: string;
  xferLocnCd: string;
  caseCancelledInd: boolean;
  asaClsfnCd: string;
  asaEmergInd: boolean;
  difficultAirwayInd: boolean;
  plannedAirwayEquipUsedInd: boolean;
  compOrInd: boolean;
  anesStartTime: string;
  caseCancelledStgCd: string;
  multiModalPainMgmtCd: string;
  priorOsaDiagInd: boolean;
  patIncapacitatedInd : boolean;
  preopEvalOsaPosInd: boolean;
  osaEducationInd: boolean;
  osaMitigationUsedInd: boolean;
  patSmokeInd: boolean;
  patSmokeCessInd: boolean;
  patSmokeDosInd: boolean;
  maintInhAgentUsedInd: boolean;
  ponvHighRiskInd: boolean;
  combTherCd: string;
  importResult: any;
  hasDateOfService: boolean;
  hasAnesthesiaProvider: boolean;
  surgeonNpi: string;
  anesProvidersList: any;
  allCptCodes: any;
  allCptCnt: number;
  compList: any;
  compCnt: number;
  postDischStatusAssessedCd: string;
  primaryAnesthetic: string;
  anesthesiaStartDateTime: Date;
  anesthesiaEndDateTime: Date;
  patientBodyTemp: number;
  nerveBlockInd: boolean;
  secondProviderDiffAirwayInd: boolean;
  outpatientHospAscInd: boolean;
  sendSurveyCd: string;
  surveyEmailAddress: string;
  surveyMobilPhoneNumber: string;
  qcdrEvalSurveyId: number;
  qcdrEvalSurveyAudVer: number;
  surveyGuid: string;
  surveyStateCode: string;
  surveySentTimestamp: string;
  surveyResponseReceviedTimestamp: string;
  surveyResponseData: string;
}

export async function get2020QcdrFormFacts(orgInternalName:string, facilityId:number, currentEvalEngineVersion:string, onlyFormsPendingCalculation:boolean = true, encounterFormId?:number):Promise<Get2020EncounterFormPendingQcdrCalculationResult[]>
{
  var query = `
WITH cases AS ( /* class@PQRSAnalyticsDAO.get2020QcdrFormFacts */
   SELECT e.fac_id,
          ef.enctr_form_id,
          e.enctr_no,
          e.pat_mrn AS enctr_pat_mrn,
          ef.form_cmplt_pct,
          ef.form_valid_ind,
          DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
          CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
          efs.aud_ver AS enctr_form_aud_ver,
          efs.qcdr_eval_enctr_form_ver,
          efs.proc_dt,
          CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
          CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
          efs.pacu_pain_score_cd,
          efs.prim_anes_typ_cd,
          efs.preop_eval_osa_cd,
          efs.xfer_locn_cd,
          COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
          efs.asa_clsfn_cd,
          efs.asa_emerg_ind,
          efs.difficult_airway_ind,
          efs.planned_airway_equip_used_ind,
          efs.comp_or_ind,
          efs.anes_st_tm,
          efs.case_cancelled_stg_cd,
          efs.multi_modal_pain_mgmt_cd,
          efs.prior_osa_diag_ind,
          efs.pat_incapacitated_ind ,
          efs.preop_eval_osa_pos_ind,
          efs.osa_education_ind,
          efs.osa_mitigation_used_ind,
          efs.pat_smoke_ind,
          efs.pat_smoke_cess_ind,
          efs.pat_smoke_dos_ind,
          efs.maint_inh_agent_used_ind,
          efs.ponv_high_risk_ind,
          efs.comb_ther_cd,
          efs.post_disch_status_assessed_cd,
          efs.second_prvr_da_indctd_ind,
          efs.outpatient_hosp_asc_ind,
          efs.send_survey_cd,
          efs.survey_email_address,
          efs.survey_mobile_phone_number,
          efs.qcdr_eval_survey_id,
          efs.qcdr_eval_survey_aud_ver,
          (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
          (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
          CASE
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                -- treat value as Fahrenheit and convert to Celsius
                ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                -- treat value as Celsius
                efs.pat_body_temp
             ELSE NULL
          END AS pat_body_temp,
          efs.import_result
     FROM enctr e
     JOIN enctr_form ef
       ON ef.enctr_id = e.enctr_id
      AND ef.void_ind IS NOT DISTINCT FROM FALSE
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
     JOIN enctr_form_surgery efs
       ON efs.enctr_form_id = ef.enctr_form_id
    WHERE e.fac_id = :facilityId
      AND efs.proc_dt IS NOT NULL
      AND efs.proc_dt BETWEEN '2020-01-01' AND '2020-12-31'
  `;
  if(onlyFormsPendingCalculation) {
    query += `
      /* only include forms needing updated QCDR results */
      AND (-- 1. form has been updated since last QCDR evaluation
           COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
           -- 2. rules engine logic has been updated
           COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion OR
           -- 3. a MACRA2020 survey for the form has been added or updated
           EXISTS (WITH surveys AS (
                      SELECT jsonb_array_elements(ef.enctr_form_surveys) AS survey
                   )
                   SELECT 1
                     FROM surveys
                    WHERE survey->>'survey_code' = 'MACRA2020'
                      AND COALESCE((survey->>'survey_aud_ver')::BIGINT,0) <> COALESCE(efs.qcdr_eval_survey_aud_ver,0)
                  )
          )
    `;
  }

  if(encounterFormId) {
    query += `
      /* only a specific encounter form */
      AND ef.enctr_form_id = :encounterFormId
    `;
  }

  query += `
),
comps AS (
   SELECT c.fac_id,
          c.enctr_form_id,
          ARRAY_AGG(comp_nm) AS comp_list
     FROM rpt_comp_pivot_v v
     JOIN cases c
       ON c.fac_id = v.fac_id
      AND c.enctr_form_id = v.enctr_form_id
    WHERE comp_ind = 1
    GROUP BY c.fac_id,
             c.enctr_form_id
),
cpts AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
          COUNT(DISTINCT cpt_cd) AS cpt_cnt
     FROM (SELECT c.fac_id,
                  c.enctr_form_id,
                  psd.prop_val AS cpt_cd
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) cpt_list
    GROUP BY fac_id,
             enctr_form_id
),
nerve_blocks AS (
    SELECT fac_id,
           enctr_form_id,
           COUNT(*) AS cpt_cnt
      FROM (SELECT c.fac_id,
                   c.enctr_form_id,
                   psd.prop_val AS cpt_cd
              FROM page_surgery_dtl psd
              JOIN page_surgery ps
                ON ps.page_id = psd.page_id
              JOIN cases c
                ON c.enctr_form_id = ps.enctr_form_id
             WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
               AND psd.prop_seq IN (4,5)
               AND psd.prop_val IS NOT NULL) cpt_list
     GROUP BY fac_id,
              enctr_form_id
),
anes_prvrs AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
          COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
     FROM (SELECT p.fac_id,
                  c.enctr_form_id,
                  p.natl_prvr_id AS anes_prvr_npi
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
             JOIN prvr p
               ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) anes_staff
    GROUP BY fac_id,
             enctr_form_id
)
SELECT cases.fac_id                                      AS "facilityId",
       cases.enctr_form_id                               AS "encounterFormId",
       enctr_no                                          AS "enctrNo",
       enctr_pat_mrn                                     AS "enctrPatMrn",
       form_cmplt_pct                                    AS "formCmpltPct",
       form_valid_ind                                    AS "formValidInd",
       enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
       enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
       enctr_form_aud_ver                                AS "enctrFormAudVer",
       qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
       proc_dt                                           AS "dateOfService",
       pat_age_years                                     AS "patAgeYears",
       pacu_pain_score_cd                                AS "painScoreCd",
       xfer_locn_cd                                      AS "xferLocnCd",
       case_cancelled_ind                                AS "caseCancelledInd",
       asa_clsfn_cd                                      AS "asaClsfnCd",
       cases.asa_emerg_ind                               AS "asaEmergInd",
       difficult_airway_ind                              AS "difficultAirwayInd",
       planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
       comp_or_ind                                       AS "compOrInd",
       anes_st_tm                                        AS "anesStartTime",
       case_cancelled_stg_cd                             AS "caseCancelledStgCd",
       multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
       prior_osa_diag_ind                                AS "priorOsaDiagInd",
       pat_incapacitated_ind                             AS "patIncapacitatedInd",
       preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
       osa_education_ind                                 AS "osaEducationInd",
       osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
       pat_smoke_ind                                     AS "patSmokeInd",
       pat_smoke_cess_ind                                AS "patSmokeCessInd",
       pat_smoke_dos_ind                                 AS "patSmokeDosInd",
       maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
       ponv_high_risk_ind                                AS "ponvHighRiskInd",
       comb_ther_cd                                      AS "combTherCd",
       import_result                                     AS "importResult",
       CASE
          WHEN proc_dt IS NOT NULL THEN TRUE
          ELSE FALSE
       END                                               AS "hasDateOfService",
       CASE
          WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
          ELSE FALSE
       END                                               AS "hasAnesthesiaProvider",
       COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
       anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
       cpts.cpt_list                                     AS "allCptCodes",
       COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
       comps.comp_list                                   AS "compList",
       COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
       post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
       prim_anes_typ_cd                                  AS "primaryAnesthetic",
       anes_st_dttm                                      AS "anesthesiaStartDateTime",
       anes_end_dttm                                     AS "anesthesiaEndDateTime",
       pat_body_temp                                     AS "patientBodyTemp",
       CASE
          WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
               nerve_blocks.cpt_cnt > 0 THEN TRUE
          ELSE FALSE
       END                                               AS "nerveBlockInd",
       second_prvr_da_indctd_ind                         AS "secondProviderDiffAirwayInd",
       outpatient_hosp_asc_ind                           AS "outpatientHospAscInd",
       send_survey_cd                                    AS "sendSurveyCd",
       survey_email_address                              AS "surveyEmailAddress",
       survey_mobile_phone_number                        AS "surveyMobilPhoneNumber",
       qcdr_eval_survey_id                               AS "qcdrEvalSurveyId",
       qcdr_eval_survey_aud_ver                          AS "qcdrEvalSurveyAudVer"
  FROM cases
  LEFT JOIN comps
    ON comps.fac_id = cases.fac_id
   AND comps.enctr_form_id = cases.enctr_form_id
  LEFT JOIN cpts
    ON cpts.fac_id = cases.fac_id
   AND cpts.enctr_form_id = cases.enctr_form_id
  LEFT JOIN anes_prvrs
    ON anes_prvrs.fac_id = cases.fac_id
   AND anes_prvrs.enctr_form_id = cases.enctr_form_id
  LEFT JOIN prvr surgn
    ON surgn.prvr_id = cases.surgn_prvr_id
  LEFT JOIN nerve_blocks
    ON nerve_blocks.fac_id = cases.fac_id
   AND nerve_blocks.enctr_form_id = cases.enctr_form_id
 `;

  var queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      encounterFormId: encounterFormId,
      currentEvalEngineVersion: currentEvalEngineVersion
    }
  };

  if (!orgInternalName) {
    throw new Error('Missing parameter orgInternalName.');
  }

  let queryResult = await orgModels.query(orgInternalName, query, queryOptions);

  // extract Encounter Form Ids
  let encounterFormList = queryResult.map(function(encounterForm) {
    return encounterForm.encounterFormId;
  });

  // retrieve survey results for encounter forms
  let surveyResult = await GetSurveyResponsesForEncounterForms(orgInternalName, facilityId, 'MACRA2020', encounterFormList);

  //merge survey results by encounterFormId
  let queryResultWithSurveys:unknown = _(queryResult).concat(surveyResult).groupBy('encounterFormId').map(_.spread(_.assign)).value();

  return <Get2020EncounterFormPendingQcdrCalculationResult[]> queryResultWithSurveys;
}

export interface Get2021EncounterFormPendingQcdrCalculationResult {
    facilityId: number;
    encounterFormId: string;
    enctrNo: string;
    enctrPatMrn: string;
    formCmpltPct: string;
    formValidInd: boolean;
    enctrFormUpdDtUtc: Date;
    enctrFormUpdTmUtc: string;
    enctrFormAudVer: number;
    qcdrEvalEnctrFormVer: number;
    dateOfService: Date;
    patAgeYears: number;
    painScoreCd: string;
    xferLocnCd: string;
    caseCancelledInd: boolean;
    asaClsfnCd: string;
    asaEmergInd: boolean;
    difficultAirwayInd: boolean;
    plannedAirwayEquipUsedInd: boolean;
    compOrInd: boolean;
    anesStartTime: string;
    caseCancelledStgCd: string;
    multiModalPainMgmtCd: string;
    priorOsaDiagInd: boolean;
    patIncapacitatedInd : boolean;
    preopEvalOsaPosInd: boolean;
    osaEducationInd: boolean;
    osaMitigationUsedInd: boolean;
    patSmokeInd: boolean;
    patSmokeCessInd: boolean;
    patSmokeDosInd: boolean;
    maintInhAgentUsedInd: boolean;
    ponvHighRiskInd: boolean;
    combTherCd: string;
    importResult: any;
    hasDateOfService: boolean;
    hasAnesthesiaProvider: boolean;
    surgeonNpi: string;
    anesProvidersList: any;
    allCptCodes: any;
    allCptCnt: number;
    compList: any;
    compCnt: number;
    postDischStatusAssessedCd: string;
    primaryAnesthetic: string;
    anesthesiaStartDateTime: Date;
    anesthesiaEndDateTime: Date;
    patientBodyTemp: number;
    nerveBlockInd: boolean;
    secondProviderDiffAirwayInd: boolean;
    sendSurveyCd: string;
    surveyEmailAddress: string;
    surveyMobilPhoneNumber: string;
    nonOrSettingCaseInd: boolean;
    etco2MonitoredInd: boolean;
    phenylephrineAdminCd: string;
    laborEpiduralFailureInd: boolean;
    primaryTkaInd: boolean;
    nerveBlockUsedCd: string;
    shoulderArthroInd: boolean;
    upperExtremityBlockCd: string;
    electiveCsectionInd: boolean;
    laborEpiduralConvertedCsectionInd: boolean;
    qcdrEvalSurveyId: number;
    qcdrEvalSurveyAudVer: number;
    surveyGuid: string;
    surveyStateCode: string;
    surveySentTimestamp: string;
    surveyResponseReceviedTimestamp: string;
    surveyResponseData: string;
  }

  export async function get2021QcdrFormFacts(orgInternalName:string, facilityId:number, currentEvalEngineVersion:string, onlyFormsPendingCalculation:boolean = true, encounterFormId?:number):Promise<Get2021EncounterFormPendingQcdrCalculationResult[]>
  {
    var query = `
  WITH cases AS ( /* class@PQRSAnalyticsDAO.get2021QcdrFormFacts */
     SELECT e.fac_id,
            ef.enctr_form_id,
            e.enctr_no,
            e.pat_mrn AS enctr_pat_mrn,
            ef.form_cmplt_pct,
            ef.form_valid_ind,
            DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
            CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
            efs.aud_ver AS enctr_form_aud_ver,
            efs.qcdr_eval_enctr_form_ver,
            efs.proc_dt,
            CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
            CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
            efs.pacu_pain_score_cd,
            efs.prim_anes_typ_cd,
            efs.preop_eval_osa_cd,
            efs.xfer_locn_cd,
            COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
            efs.asa_clsfn_cd,
            efs.asa_emerg_ind,
            efs.difficult_airway_ind,
            efs.planned_airway_equip_used_ind,
            efs.comp_or_ind,
            efs.anes_st_tm,
            efs.case_cancelled_stg_cd,
            efs.multi_modal_pain_mgmt_cd,
            efs.prior_osa_diag_ind,
            efs.pat_incapacitated_ind ,
            efs.preop_eval_osa_pos_ind,
            efs.osa_education_ind,
            efs.osa_mitigation_used_ind,
            efs.pat_smoke_ind,
            efs.pat_smoke_cess_ind,
            efs.pat_smoke_dos_ind,
            efs.maint_inh_agent_used_ind,
            efs.ponv_high_risk_ind,
            efs.comb_ther_cd,
            efs.post_disch_status_assessed_cd,
            efs.second_prvr_da_indctd_ind,
            efs.send_survey_cd,
            efs.survey_email_address,
            efs.survey_mobile_phone_number,
            efs.non_or_setting_case_ind,
            efs.etco2_monitored_ind,
            efs.phenylephrine_admin_cd,
            efs.labor_epidural_failure_ind,
            efs.primary_tka_ind,
            efs.nerve_block_used_cd,
            efs.shoulder_arthro_ind,
            efs.upper_extremity_block_cd,
            efs.elective_csection_ind,
            efs.labor_epidural_converted_csection_ind,
            efs.qcdr_eval_survey_id,
            efs.qcdr_eval_survey_aud_ver,
            (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
            (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
            CASE
               WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                  -- treat value as Fahrenheit and convert to Celsius
                  ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
               WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                  -- treat value as Celsius
                  efs.pat_body_temp
               ELSE NULL
            END AS pat_body_temp,
            efs.import_result
       FROM enctr e
       JOIN enctr_form ef
         ON ef.enctr_id = e.enctr_id
        AND ef.void_ind IS NOT DISTINCT FROM FALSE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
       JOIN enctr_form_surgery efs
         ON efs.enctr_form_id = ef.enctr_form_id
      WHERE e.fac_id = :facilityId
        AND efs.proc_dt IS NOT NULL
        AND efs.proc_dt BETWEEN '2021-01-01' AND '2021-12-31'
    `;
    if(onlyFormsPendingCalculation) {
      query += `
        /* only include forms needing updated QCDR results */
        AND (-- 1. form has been updated since last QCDR evaluation
             COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
             -- 2. rules engine logic has been updated
             COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion OR
             -- 3. a MACRA2020 survey for the form has been added or updated
             EXISTS (WITH surveys AS (
                        SELECT jsonb_array_elements(ef.enctr_form_surveys) AS survey
                     )
                     SELECT 1
                       FROM surveys
                      WHERE survey->>'survey_code' = 'MACRA2020'
                        AND COALESCE((survey->>'survey_aud_ver')::BIGINT,0) <> COALESCE(efs.qcdr_eval_survey_aud_ver,0)
                    )
            )
      `;
    }

    if(encounterFormId) {
      query += `
        /* only a specific encounter form */
        AND ef.enctr_form_id = :encounterFormId
      `;
    }

    query += `
  ),
  comps AS (
     SELECT c.fac_id,
            c.enctr_form_id,
            ARRAY_AGG(comp_nm) AS comp_list
       FROM rpt_comp_pivot_v v
       JOIN cases c
         ON c.fac_id = v.fac_id
        AND c.enctr_form_id = v.enctr_form_id
      WHERE comp_ind = 1
      GROUP BY c.fac_id,
               c.enctr_form_id
  ),
  cpts AS (
     SELECT fac_id,
            enctr_form_id,
            ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
            COUNT(DISTINCT cpt_cd) AS cpt_cnt
       FROM (SELECT c.fac_id,
                    c.enctr_form_id,
                    psd.prop_val AS cpt_cd
               FROM page_surgery_dtl psd
               JOIN page_surgery ps
                 ON ps.page_id = psd.page_id
               JOIN cases c
                 ON c.enctr_form_id = ps.enctr_form_id
              WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
                AND psd.prop_val IS NOT NULL) cpt_list
      GROUP BY fac_id,
               enctr_form_id
  ),
  nerve_blocks AS (
      SELECT fac_id,
             enctr_form_id,
             COUNT(*) AS cpt_cnt
        FROM (SELECT c.fac_id,
                     c.enctr_form_id,
                     psd.prop_val AS cpt_cd
                FROM page_surgery_dtl psd
                JOIN page_surgery ps
                  ON ps.page_id = psd.page_id
                JOIN cases c
                  ON c.enctr_form_id = ps.enctr_form_id
               WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
                 AND psd.prop_seq IN (4,5)
                 AND psd.prop_val IS NOT NULL) cpt_list
       GROUP BY fac_id,
                enctr_form_id
  ),
  anes_prvrs AS (
     SELECT fac_id,
            enctr_form_id,
            ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
            COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
       FROM (SELECT p.fac_id,
                    c.enctr_form_id,
                    p.natl_prvr_id AS anes_prvr_npi
               FROM page_surgery_dtl psd
               JOIN page_surgery ps
                 ON ps.page_id = psd.page_id
               JOIN cases c
                 ON c.enctr_form_id = ps.enctr_form_id
               JOIN prvr p
                 ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
              WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
                AND psd.prop_val IS NOT NULL) anes_staff
      GROUP BY fac_id,
               enctr_form_id
  )
  SELECT cases.fac_id                                      AS "facilityId",
         cases.enctr_form_id                               AS "encounterFormId",
         enctr_no                                          AS "enctrNo",
         enctr_pat_mrn                                     AS "enctrPatMrn",
         form_cmplt_pct                                    AS "formCmpltPct",
         form_valid_ind                                    AS "formValidInd",
         enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
         enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
         enctr_form_aud_ver                                AS "enctrFormAudVer",
         qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
         proc_dt                                           AS "dateOfService",
         pat_age_years                                     AS "patAgeYears",
         pacu_pain_score_cd                                AS "painScoreCd",
         xfer_locn_cd                                      AS "xferLocnCd",
         case_cancelled_ind                                AS "caseCancelledInd",
         asa_clsfn_cd                                      AS "asaClsfnCd",
         cases.asa_emerg_ind                               AS "asaEmergInd",
         difficult_airway_ind                              AS "difficultAirwayInd",
         planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
         comp_or_ind                                       AS "compOrInd",
         anes_st_tm                                        AS "anesStartTime",
         case_cancelled_stg_cd                             AS "caseCancelledStgCd",
         multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
         prior_osa_diag_ind                                AS "priorOsaDiagInd",
         pat_incapacitated_ind                             AS "patIncapacitatedInd",
         preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
         osa_education_ind                                 AS "osaEducationInd",
         osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
         pat_smoke_ind                                     AS "patSmokeInd",
         pat_smoke_cess_ind                                AS "patSmokeCessInd",
         pat_smoke_dos_ind                                 AS "patSmokeDosInd",
         maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
         ponv_high_risk_ind                                AS "ponvHighRiskInd",
         comb_ther_cd                                      AS "combTherCd",
         import_result                                     AS "importResult",
         CASE
            WHEN proc_dt IS NOT NULL THEN TRUE
            ELSE FALSE
         END                                               AS "hasDateOfService",
         CASE
            WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
            ELSE FALSE
         END                                               AS "hasAnesthesiaProvider",
         COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
         anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
         cpts.cpt_list                                     AS "allCptCodes",
         COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
         comps.comp_list                                   AS "compList",
         COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
         post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
         prim_anes_typ_cd                                  AS "primaryAnesthetic",
         anes_st_dttm                                      AS "anesthesiaStartDateTime",
         anes_end_dttm                                     AS "anesthesiaEndDateTime",
         pat_body_temp                                     AS "patientBodyTemp",
         CASE
            WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
                 nerve_blocks.cpt_cnt > 0 THEN TRUE
            ELSE FALSE
         END                                               AS "nerveBlockInd",
         second_prvr_da_indctd_ind                         AS "secondProviderDiffAirwayInd",
         send_survey_cd                                    AS "sendSurveyCd",
         survey_email_address                              AS "surveyEmailAddress",
         survey_mobile_phone_number                        AS "surveyMobilPhoneNumber",
         non_or_setting_case_ind                           AS "nonOrSettingCaseInd",
         etco2_monitored_ind                               AS "etco2MonitoredInd",
         phenylephrine_admin_cd                            AS "phenylephrineAdminCd",
         labor_epidural_failure_ind                        AS "laborEpiduralFailureInd",
         primary_tka_ind                                   AS "primaryTkaInd",
         nerve_block_used_cd                               AS "nerveBlockUsedCd",
         shoulder_arthro_ind                               AS "shoulderArthroInd",
         upper_extremity_block_cd                          AS "upperExtremityBlockCd",
         elective_csection_ind                             AS "electiveCsectionInd",
         labor_epidural_converted_csection_ind             AS "laborEpiduralConvertedCsectionInd",
         qcdr_eval_survey_id                               AS "qcdrEvalSurveyId",
         qcdr_eval_survey_aud_ver                          AS "qcdrEvalSurveyAudVer"
    FROM cases
    LEFT JOIN comps
      ON comps.fac_id = cases.fac_id
     AND comps.enctr_form_id = cases.enctr_form_id
    LEFT JOIN cpts
      ON cpts.fac_id = cases.fac_id
     AND cpts.enctr_form_id = cases.enctr_form_id
    LEFT JOIN anes_prvrs
      ON anes_prvrs.fac_id = cases.fac_id
     AND anes_prvrs.enctr_form_id = cases.enctr_form_id
    LEFT JOIN prvr surgn
      ON surgn.prvr_id = cases.surgn_prvr_id
    LEFT JOIN nerve_blocks
      ON nerve_blocks.fac_id = cases.fac_id
     AND nerve_blocks.enctr_form_id = cases.enctr_form_id
   `;

    var queryOptions = {
      type: QueryTypes.SELECT,
      replacements: {
        facilityId: facilityId,
        encounterFormId: encounterFormId,
        currentEvalEngineVersion: currentEvalEngineVersion
      }
    };

    if (!orgInternalName) {
      throw new Error('Missing parameter orgInternalName.');
    }

    let queryResult = await orgModels.query(orgInternalName, query, queryOptions);

    // extract Encounter Form Ids
    let encounterFormList = queryResult.map(function(encounterForm) {
      return encounterForm.encounterFormId;
    });

    // retrieve survey results for encounter forms
    let surveyResult = await GetSurveyResponsesForEncounterForms(orgInternalName, facilityId, 'MACRA2020', encounterFormList);

    //merge survey results by encounterFormId
    let queryResultWithSurveys:unknown = _(queryResult).concat(surveyResult).groupBy('encounterFormId').map(_.spread(_.assign)).value();

    return <Get2021EncounterFormPendingQcdrCalculationResult[]> queryResultWithSurveys;
  }

  export interface Get2022EncounterFormPendingQcdrCalculationResult {
    facilityId: number;
    encounterFormId: string;
    enctrNo: string;
    enctrPatMrn: string;
    formCmpltPct: string;
    formValidInd: boolean;
    enctrFormUpdDtUtc: Date;
    enctrFormUpdTmUtc: string;
    enctrFormAudVer: number;
    qcdrEvalEnctrFormVer: number;
    dateOfService: Date;
    patAgeYears: number;
    painScoreCd: string;
    xferLocnCd: string;
    caseCancelledInd: boolean;
    asaClsfnCd: string;
    asaEmergInd: boolean;
    difficultAirwayInd: boolean;
    plannedAirwayEquipUsedInd: boolean;
    compOrInd: boolean;
    anesStartTime: string;
    caseCancelledStgCd: string;
    multiModalPainMgmtCd: string;
    priorOsaDiagInd: boolean;
    patIncapacitatedInd : boolean;
    preopEvalOsaPosInd: boolean;
    osaEducationInd: boolean;
    osaMitigationUsedInd: boolean;
    patSmokeInd: boolean;
    patSmokeCessInd: boolean;
    patSmokeDosInd: boolean;
    maintInhAgentUsedInd: boolean;
    ponvHighRiskInd: boolean;
    combTherCd: string;
    importResult: any;
    hasDateOfService: boolean;
    hasAnesthesiaProvider: boolean;
    surgeonNpi: string;
    anesProvidersList: any;
    allCptCodes: any;
    allCptCnt: number;
    compList: any;
    compCnt: number;
    postDischStatusAssessedCd: string;
    primaryAnesthetic: string;
    anesthesiaStartDateTime: Date;
    anesthesiaEndDateTime: Date;
    patientBodyTemp: number;
    nerveBlockInd: boolean;
    secondProviderDiffAirwayInd: boolean;
    sendSurveyCd: string;
    surveyEmailAddress: string;
    surveyMobilPhoneNumber: string;
    nonOrSettingCaseInd: boolean;
    etco2MonitoredInd: boolean;
    phenylephrineAdminCd: string;
    laborEpiduralFailureInd: boolean;
    primaryTkaInd: boolean;
    nerveBlockUsedCd: string;
    shoulderArthroInd: boolean;
    upperExtremityBlockCd: string;
    electiveCsectionInd: boolean;
    laborEpiduralConvertedCsectionInd: boolean;
    centralLinePlacedInd: boolean;
    centralLineTypCd: string;
    qcdrEvalSurveyId: number;
    qcdrEvalSurveyAudVer: number;
    surveyGuid: string;
    surveyStateCode: string;
    surveySentTimestamp: string;
    surveyResponseReceviedTimestamp: string;
    surveyResponseData: string;
  }

  export async function get2022QcdrFormFacts(orgInternalName:string, facilityId:number, currentEvalEngineVersion:string, onlyFormsPendingCalculation:boolean = true, encounterFormId?:number):Promise<Get2022EncounterFormPendingQcdrCalculationResult[]>
  {
    var query = `
  WITH cases AS ( /* class@PQRSAnalyticsDAO.get2022QcdrFormFacts */
     SELECT e.fac_id,
            ef.enctr_form_id,
            e.enctr_no,
            e.pat_mrn AS enctr_pat_mrn,
            ef.form_cmplt_pct,
            ef.form_valid_ind,
            DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
            CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
            efs.aud_ver AS enctr_form_aud_ver,
            efs.qcdr_eval_enctr_form_ver,
            efs.proc_dt,
            CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
            CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
            efs.pacu_pain_score_cd,
            efs.prim_anes_typ_cd,
            efs.preop_eval_osa_cd,
            efs.xfer_locn_cd,
            COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
            efs.asa_clsfn_cd,
            efs.asa_emerg_ind,
            efs.difficult_airway_ind,
            efs.planned_airway_equip_used_ind,
            efs.comp_or_ind,
            efs.anes_st_tm,
            efs.case_cancelled_stg_cd,
            efs.multi_modal_pain_mgmt_cd,
            efs.prior_osa_diag_ind,
            efs.pat_incapacitated_ind ,
            efs.preop_eval_osa_pos_ind,
            efs.osa_education_ind,
            efs.osa_mitigation_used_ind,
            efs.pat_smoke_ind,
            efs.pat_smoke_cess_ind,
            efs.pat_smoke_dos_ind,
            efs.maint_inh_agent_used_ind,
            efs.ponv_high_risk_ind,
            efs.comb_ther_cd,
            efs.post_disch_status_assessed_cd,
            efs.second_prvr_da_indctd_ind,
            efs.send_survey_cd,
            efs.survey_email_address,
            efs.survey_mobile_phone_number,
            efs.non_or_setting_case_ind,
            efs.etco2_monitored_ind,
            efs.phenylephrine_admin_cd,
            efs.labor_epidural_failure_ind,
            efs.primary_tka_ind,
            efs.nerve_block_used_cd,
            efs.shoulder_arthro_ind,
            efs.upper_extremity_block_cd,
            efs.elective_csection_ind,
            efs.labor_epidural_converted_csection_ind,
            efs.prvr_cntrl_line_plcmt_ind,
            efs.cntrl_line_typ_cd,
            efs.qcdr_eval_survey_id,
            efs.qcdr_eval_survey_aud_ver,
            (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
            (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
            CASE
               WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                  -- treat value as Fahrenheit and convert to Celsius
                  ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
               WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                  -- treat value as Celsius
                  efs.pat_body_temp
               ELSE NULL
            END AS pat_body_temp,
            efs.import_result
       FROM enctr e
       JOIN enctr_form ef
         ON ef.enctr_id = e.enctr_id
        AND ef.void_ind IS NOT DISTINCT FROM FALSE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
       JOIN enctr_form_surgery efs
         ON efs.enctr_form_id = ef.enctr_form_id
      WHERE e.fac_id = :facilityId
        AND efs.proc_dt IS NOT NULL
        AND efs.proc_dt BETWEEN '2022-01-01' AND '2022-12-31'
    `;
    if(onlyFormsPendingCalculation) {
      query += `
        /* only include forms needing updated QCDR results */
        AND (-- 1. form has been updated since last QCDR evaluation
             COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
             -- 2. rules engine logic has been updated
             COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion OR
             -- 3. a MACRA2020 survey for the form has been added or updated
             EXISTS (WITH surveys AS (
                        SELECT jsonb_array_elements(ef.enctr_form_surveys) AS survey
                     )
                     SELECT 1
                       FROM surveys
                      WHERE survey->>'survey_code' = 'MACRA2020'
                        AND COALESCE((survey->>'survey_aud_ver')::BIGINT,0) <> COALESCE(efs.qcdr_eval_survey_aud_ver,0)
                    )
            )
      `;
    }

    if(encounterFormId) {
      query += `
        /* only a specific encounter form */
        AND ef.enctr_form_id = :encounterFormId
      `;
    }

    query += `
  ),
  comps AS (
     SELECT c.fac_id,
            c.enctr_form_id,
            ARRAY_AGG(comp_nm) AS comp_list
       FROM rpt_comp_pivot_v v
       JOIN cases c
         ON c.fac_id = v.fac_id
        AND c.enctr_form_id = v.enctr_form_id
      WHERE comp_ind = 1
      GROUP BY c.fac_id,
               c.enctr_form_id
  ),
  cpts AS (
     SELECT fac_id,
            enctr_form_id,
            ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
            COUNT(DISTINCT cpt_cd) AS cpt_cnt
       FROM (SELECT c.fac_id,
                    c.enctr_form_id,
                    psd.prop_val AS cpt_cd
               FROM page_surgery_dtl psd
               JOIN page_surgery ps
                 ON ps.page_id = psd.page_id
               JOIN cases c
                 ON c.enctr_form_id = ps.enctr_form_id
              WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,anes_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
                AND psd.prop_val IS NOT NULL) cpt_list
      GROUP BY fac_id,
               enctr_form_id
  ),
  nerve_blocks AS (
      SELECT fac_id,
             enctr_form_id,
             COUNT(*) AS cpt_cnt
        FROM (SELECT c.fac_id,
                     c.enctr_form_id,
                     psd.prop_val AS cpt_cd
                FROM page_surgery_dtl psd
                JOIN page_surgery ps
                  ON ps.page_id = psd.page_id
                JOIN cases c
                  ON c.enctr_form_id = ps.enctr_form_id
               WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
                 AND psd.prop_seq IN (4,5)
                 AND psd.prop_val IS NOT NULL) cpt_list
       GROUP BY fac_id,
                enctr_form_id
  ),
  anes_prvrs AS (
     SELECT fac_id,
            enctr_form_id,
            ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
            COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
       FROM (SELECT p.fac_id,
                    c.enctr_form_id,
                    p.natl_prvr_id AS anes_prvr_npi
               FROM page_surgery_dtl psd
               JOIN page_surgery ps
                 ON ps.page_id = psd.page_id
               JOIN cases c
                 ON c.enctr_form_id = ps.enctr_form_id
               JOIN prvr p
                 ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
              WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
                AND psd.prop_val IS NOT NULL) anes_staff
      GROUP BY fac_id,
               enctr_form_id
  )
  SELECT cases.fac_id                                      AS "facilityId",
         cases.enctr_form_id                               AS "encounterFormId",
         enctr_no                                          AS "enctrNo",
         enctr_pat_mrn                                     AS "enctrPatMrn",
         form_cmplt_pct                                    AS "formCmpltPct",
         form_valid_ind                                    AS "formValidInd",
         enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
         enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
         enctr_form_aud_ver                                AS "enctrFormAudVer",
         qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
         proc_dt                                           AS "dateOfService",
         pat_age_years                                     AS "patAgeYears",
         pacu_pain_score_cd                                AS "painScoreCd",
         xfer_locn_cd                                      AS "xferLocnCd",
         case_cancelled_ind                                AS "caseCancelledInd",
         asa_clsfn_cd                                      AS "asaClsfnCd",
         cases.asa_emerg_ind                               AS "asaEmergInd",
         difficult_airway_ind                              AS "difficultAirwayInd",
         planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
         comp_or_ind                                       AS "compOrInd",
         anes_st_tm                                        AS "anesStartTime",
         case_cancelled_stg_cd                             AS "caseCancelledStgCd",
         multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
         prior_osa_diag_ind                                AS "priorOsaDiagInd",
         pat_incapacitated_ind                             AS "patIncapacitatedInd",
         preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
         osa_education_ind                                 AS "osaEducationInd",
         osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
         pat_smoke_ind                                     AS "patSmokeInd",
         pat_smoke_cess_ind                                AS "patSmokeCessInd",
         pat_smoke_dos_ind                                 AS "patSmokeDosInd",
         maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
         ponv_high_risk_ind                                AS "ponvHighRiskInd",
         comb_ther_cd                                      AS "combTherCd",
         import_result                                     AS "importResult",
         CASE
            WHEN proc_dt IS NOT NULL THEN TRUE
            ELSE FALSE
         END                                               AS "hasDateOfService",
         CASE
            WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
            ELSE FALSE
         END                                               AS "hasAnesthesiaProvider",
         COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
         anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
         cpts.cpt_list                                     AS "allCptCodes",
         COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
         comps.comp_list                                   AS "compList",
         COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
         post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
         prim_anes_typ_cd                                  AS "primaryAnesthetic",
         anes_st_dttm                                      AS "anesthesiaStartDateTime",
         anes_end_dttm                                     AS "anesthesiaEndDateTime",
         pat_body_temp                                     AS "patientBodyTemp",
         CASE
            WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
                 nerve_blocks.cpt_cnt > 0 THEN TRUE
            ELSE FALSE
         END                                               AS "nerveBlockInd",
         second_prvr_da_indctd_ind                         AS "secondProviderDiffAirwayInd",
         send_survey_cd                                    AS "sendSurveyCd",
         survey_email_address                              AS "surveyEmailAddress",
         survey_mobile_phone_number                        AS "surveyMobilPhoneNumber",
         non_or_setting_case_ind                           AS "nonOrSettingCaseInd",
         etco2_monitored_ind                               AS "etco2MonitoredInd",
         phenylephrine_admin_cd                            AS "phenylephrineAdminCd",
         labor_epidural_failure_ind                        AS "laborEpiduralFailureInd",
         primary_tka_ind                                   AS "primaryTkaInd",
         nerve_block_used_cd                               AS "nerveBlockUsedCd",
         shoulder_arthro_ind                               AS "shoulderArthroInd",
         upper_extremity_block_cd                          AS "upperExtremityBlockCd",
         elective_csection_ind                             AS "electiveCsectionInd",
         labor_epidural_converted_csection_ind             AS "laborEpiduralConvertedCsectionInd",
         prvr_cntrl_line_plcmt_ind                         AS "centralLinePlacedInd",
         cntrl_line_typ_cd                                 AS "centralLineTypCd",
         qcdr_eval_survey_id                               AS "qcdrEvalSurveyId",
         qcdr_eval_survey_aud_ver                          AS "qcdrEvalSurveyAudVer"
    FROM cases
    LEFT JOIN comps
      ON comps.fac_id = cases.fac_id
     AND comps.enctr_form_id = cases.enctr_form_id
    LEFT JOIN cpts
      ON cpts.fac_id = cases.fac_id
     AND cpts.enctr_form_id = cases.enctr_form_id
    LEFT JOIN anes_prvrs
      ON anes_prvrs.fac_id = cases.fac_id
     AND anes_prvrs.enctr_form_id = cases.enctr_form_id
    LEFT JOIN prvr surgn
      ON surgn.prvr_id = cases.surgn_prvr_id
    LEFT JOIN nerve_blocks
      ON nerve_blocks.fac_id = cases.fac_id
     AND nerve_blocks.enctr_form_id = cases.enctr_form_id
   `;

    var queryOptions = {
      type: QueryTypes.SELECT,
      replacements: {
        facilityId: facilityId,
        encounterFormId: encounterFormId,
        currentEvalEngineVersion: currentEvalEngineVersion
      }
    };

    if (!orgInternalName) {
      throw new Error('Missing parameter orgInternalName.');
    }

    let queryResult = await orgModels.query(orgInternalName, query, queryOptions);

    // extract Encounter Form Ids
    let encounterFormList = queryResult.map(function(encounterForm) {
      return encounterForm.encounterFormId;
    });

    // retrieve survey results for encounter forms
    let surveyResult = await GetSurveyResponsesForEncounterForms(orgInternalName, facilityId, 'MACRA2020', encounterFormList);

    //merge survey results by encounterFormId
    let queryResultWithSurveys:unknown = _(queryResult).concat(surveyResult).groupBy('encounterFormId').map(_.spread(_.assign)).value();

    return <Get2022EncounterFormPendingQcdrCalculationResult[]> queryResultWithSurveys;
  }

  export interface Get2023EncounterFormPendingQcdrCalculationResult {
      facilityId: number;
      encounterFormId: string;
      enctrNo: string;
      enctrPatMrn: string;
      formCmpltPct: string;
      formValidInd: boolean;
      enctrFormUpdDtUtc: Date;
      enctrFormUpdTmUtc: string;
      enctrFormAudVer: number;
      qcdrEvalEnctrFormVer: number;
      dateOfService: Date;
      patAgeYears: number;
      painScoreCd: string;
      xferLocnCd: string;
      caseCancelledInd: boolean;
      asaClsfnCd: string;
      asaEmergInd: boolean;
      difficultAirwayInd: boolean;
      plannedAirwayEquipUsedInd: boolean;
      compOrInd: boolean;
      anesStartTime: string;
      caseCancelledStgCd: string;
      multiModalPainMgmtCd: string;
      priorOsaDiagInd: boolean;
      patIncapacitatedInd: boolean;
      preopEvalOsaPosInd: boolean;
      osaEducationInd: boolean;
      osaMitigationUsedInd: boolean;
      patSmokeInd: boolean;
      patSmokeCessInd: boolean;
      patSmokeDosInd: boolean;
      maintInhAgentUsedInd: boolean;
      ponvHighRiskInd: boolean;
      combTherCd: string;
      importResult: any;
      hasDateOfService: boolean;
      hasAnesthesiaProvider: boolean;
      surgeonNpi: string;
      anesProvidersList: any;
      allCptCodes: any;
      allCptCnt: number;
      compList: any;
      compCnt: number;
      postDischStatusAssessedCd: string;
      primaryAnesthetic: string;
      anesthesiaStartDateTime: Date;
      anesthesiaEndDateTime: Date;
      patientBodyTemp: number;
      nerveBlockInd: boolean;
      secondProviderDiffAirwayInd: boolean;
      sendSurveyCd: string;
      surveyEmailAddress: string;
      surveyMobilPhoneNumber: string;
      nonOrSettingCaseInd: boolean;
      etco2MonitoredInd: boolean;
      phenylephrineAdminCd: string;
      laborEpiduralFailureInd: boolean;
      primaryTkaInd: boolean;
      nerveBlockUsedCd: string;
      shoulderArthroInd: boolean;
      upperExtremityBlockCd: string;
      electiveCsectionInd: boolean;
      laborEpiduralConvertedCsectionInd: boolean;
      centralLinePlacedInd: boolean;
      centralLineTypCd: string;
      osaScreenCd: string;
      osaMitigationUsedCd: string;
      hipArthroplastyInd: boolean;
      shoulderArthroplastyInd: boolean;
      shoulderArthroscopyInd: boolean;
      anemiaScreenCd: string;
      anemiaScreenPosInd: boolean;
      dtuAnemiaManagementCd: string;
      lowFlowMaintenanceUsedCd: string;
      arterialLineTypCd: string;
      dtuArterialLinePlcmtCd: string;
      bypassPerformedInd: boolean;
      hypothermiaDuringBypassCd: string;
      caseCancelledTimeSpentMins: number;
      sameDayDistinctProcedureInd: boolean;
      amaCptLicenseInd: boolean;
      qcdrEvalSurveyId: number;
      qcdrEvalSurveyAudVer: number;
      surveyGuid: string;
      surveyStateCode: string;
      surveySentTimestamp: string;
      surveyResponseReceviedTimestamp: string;
      surveyResponseData: string;
  }

export async function get2023QcdrFormFacts(
    orgInternalName: string,
    facilityId: number,
    currentEvalEngineVersion: string,
    onlyFormsPendingCalculation: boolean = true,
    encounterFormId?: number,
): Promise<Get2023EncounterFormPendingQcdrCalculationResult[]> {
    var query = `
WITH cases AS ( /* class@PQRSAnalyticsDAO.get2023QcdrFormFacts */
   SELECT e.fac_id,
          ef.enctr_form_id,
          e.enctr_no,
          e.pat_mrn AS enctr_pat_mrn,
          ef.form_cmplt_pct,
          ef.form_valid_ind,
          DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
          CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
          efs.aud_ver AS enctr_form_aud_ver,
          efs.qcdr_eval_enctr_form_ver,
          efs.proc_dt,
          CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
          CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
          efs.pacu_pain_score_cd,
          efs.prim_anes_typ_cd,
          efs.preop_eval_osa_cd,
          efs.xfer_locn_cd,
          COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
          efs.asa_clsfn_cd,
          efs.asa_emerg_ind,
          efs.difficult_airway_ind,
          efs.planned_airway_equip_used_ind,
          efs.comp_or_ind,
          efs.anes_st_tm,
          efs.case_cancelled_stg_cd,
          efs.multi_modal_pain_mgmt_cd,
          efs.prior_osa_diag_ind,
          efs.pat_incapacitated_ind ,
          efs.preop_eval_osa_pos_ind,
          efs.osa_education_ind,
          efs.osa_mitigation_used_ind,
          efs.pat_smoke_ind,
          efs.pat_smoke_cess_ind,
          efs.pat_smoke_dos_ind,
          efs.maint_inh_agent_used_ind,
          efs.ponv_high_risk_ind,
          efs.comb_ther_cd,
          efs.post_disch_status_assessed_cd,
          efs.second_prvr_da_indctd_ind,
          efs.send_survey_cd,
          efs.survey_email_address,
          efs.survey_mobile_phone_number,
          efs.non_or_setting_case_ind,
          efs.etco2_monitored_ind,
          efs.phenylephrine_admin_cd,
          efs.labor_epidural_failure_ind,
          efs.primary_tka_ind,
          efs.nerve_block_used_cd,
          efs.shoulder_arthro_ind,
          efs.upper_extremity_block_cd,
          efs.elective_csection_ind,
          efs.labor_epidural_converted_csection_ind,
          efs.prvr_cntrl_line_plcmt_ind,
          efs.cntrl_line_typ_cd,
          efs.osa_screen_cd,
          efs.osa_mitigation_used_cd,
          efs.hip_arthroplasty_ind,
          efs.shoulder_arthroplasty_ind,
          efs.shoulder_arthroscopy_ind,
          efs.anemia_screen_cd,
          efs.anemia_screen_pos_ind,
          efs.dtu_anemia_management_cd,
          efs.low_flow_maintenance_used_cd,
          efs.arterial_line_typ_cd,
          efs.dtu_arterial_line_plcmt_cd,
          efs.bypass_performed_ind,
          efs.hypothermia_during_bypass_cd,
          efs.case_cancelled_time_spent_mins,
          efs.same_day_distinct_procedure_ind,
          efs.ama_cpt_license_ind,
          efs.qcdr_eval_survey_id,
          efs.qcdr_eval_survey_aud_ver,
          (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
          (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
          CASE
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                -- treat value as Fahrenheit and convert to Celsius
                ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                -- treat value as Celsius
                efs.pat_body_temp
             ELSE NULL
          END AS pat_body_temp,
          efs.import_result
     FROM enctr e
     JOIN enctr_form ef
       ON ef.enctr_id = e.enctr_id
      AND ef.void_ind IS NOT DISTINCT FROM FALSE
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
     JOIN enctr_form_surgery efs
       ON efs.enctr_form_id = ef.enctr_form_id
    WHERE e.fac_id = :facilityId
      AND efs.proc_dt IS NOT NULL
      AND efs.proc_dt BETWEEN '2023-01-01' AND '2023-12-31'
  `;
    if (onlyFormsPendingCalculation) {
        query += `
      /* only include forms needing updated QCDR results */
      AND (-- 1. form has been updated since last QCDR evaluation
           COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
           -- 2. rules engine logic has been updated
           COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion OR
           -- 3. a MACRA2020 survey for the form has been added or updated
           EXISTS (WITH surveys AS (
                      SELECT jsonb_array_elements(ef.enctr_form_surveys) AS survey
                   )
                   SELECT 1
                     FROM surveys
                    WHERE survey->>'survey_code' = 'MACRA2020'
                      AND COALESCE((survey->>'survey_aud_ver')::BIGINT,0) <> COALESCE(efs.qcdr_eval_survey_aud_ver,0)
                  )
          )
    `;
    }

    if (encounterFormId) {
        query += `
      /* only a specific encounter form */
      AND ef.enctr_form_id = :encounterFormId
    `;
    }

    query += `
),
comps AS (
   SELECT c.fac_id,
          c.enctr_form_id,
          ARRAY_AGG(comp_nm) AS comp_list
     FROM rpt_comp_pivot_v v
     JOIN cases c
       ON c.fac_id = v.fac_id
      AND c.enctr_form_id = v.enctr_form_id
    WHERE comp_ind = 1
    GROUP BY c.fac_id,
             c.enctr_form_id
),
cpts AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
          COUNT(DISTINCT cpt_cd) AS cpt_cnt
     FROM (SELECT c.fac_id,
                  c.enctr_form_id,
                  psd.prop_val AS cpt_cd
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,anes_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) cpt_list
    GROUP BY fac_id,
             enctr_form_id
),
nerve_blocks AS (
    SELECT fac_id,
           enctr_form_id,
           COUNT(*) AS cpt_cnt
      FROM (SELECT c.fac_id,
                   c.enctr_form_id,
                   psd.prop_val AS cpt_cd
              FROM page_surgery_dtl psd
              JOIN page_surgery ps
                ON ps.page_id = psd.page_id
              JOIN cases c
                ON c.enctr_form_id = ps.enctr_form_id
             WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
               AND psd.prop_seq IN (4,5)
               AND psd.prop_val IS NOT NULL) cpt_list
     GROUP BY fac_id,
              enctr_form_id
),
anes_prvrs AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
          COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
     FROM (SELECT p.fac_id,
                  c.enctr_form_id,
                  p.natl_prvr_id AS anes_prvr_npi
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
             JOIN prvr p
               ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) anes_staff
    GROUP BY fac_id,
             enctr_form_id
)
SELECT cases.fac_id                                      AS "facilityId",
       cases.enctr_form_id                               AS "encounterFormId",
       enctr_no                                          AS "enctrNo",
       enctr_pat_mrn                                     AS "enctrPatMrn",
       form_cmplt_pct                                    AS "formCmpltPct",
       form_valid_ind                                    AS "formValidInd",
       enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
       enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
       enctr_form_aud_ver                                AS "enctrFormAudVer",
       qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
       proc_dt                                           AS "dateOfService",
       pat_age_years                                     AS "patAgeYears",
       pacu_pain_score_cd                                AS "painScoreCd",
       xfer_locn_cd                                      AS "xferLocnCd",
       case_cancelled_ind                                AS "caseCancelledInd",
       asa_clsfn_cd                                      AS "asaClsfnCd",
       cases.asa_emerg_ind                               AS "asaEmergInd",
       difficult_airway_ind                               AS "difficultAirwayInd",
       planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
       comp_or_ind                                       AS "compOrInd",
       anes_st_tm                                        AS "anesStartTime",
       case_cancelled_stg_cd                             AS "caseCancelledStgCd",
       multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
       prior_osa_diag_ind                                AS "priorOsaDiagInd",
       pat_incapacitated_ind                             AS "patIncapacitatedInd",
       preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
       osa_education_ind                                 AS "osaEducationInd",
       osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
       pat_smoke_ind                                     AS "patSmokeInd",
       pat_smoke_cess_ind                                AS "patSmokeCessInd",
       pat_smoke_dos_ind                                 AS "patSmokeDosInd",
       maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
       ponv_high_risk_ind                                AS "ponvHighRiskInd",
       comb_ther_cd                                      AS "combTherCd",
       import_result                                     AS "importResult",
       CASE
          WHEN proc_dt IS NOT NULL THEN TRUE
          ELSE FALSE
       END                                               AS "hasDateOfService",
       CASE
          WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
          ELSE FALSE
       END                                               AS "hasAnesthesiaProvider",
       COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
       anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
       cpts.cpt_list                                     AS "allCptCodes",
       COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
       comps.comp_list                                   AS "compList",
       COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
       post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
       prim_anes_typ_cd                                  AS "primaryAnesthetic",
       anes_st_dttm                                      AS "anesthesiaStartDateTime",
       anes_end_dttm                                     AS "anesthesiaEndDateTime",
       pat_body_temp                                     AS "patientBodyTemp",
       CASE
          WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
               nerve_blocks.cpt_cnt > 0 THEN TRUE
          ELSE FALSE
       END                                               AS "nerveBlockInd",
       second_prvr_da_indctd_ind                         AS "secondProviderDiffAirwayInd",
       send_survey_cd                                    AS "sendSurveyCd",
       survey_email_address                              AS "surveyEmailAddress",
       survey_mobile_phone_number                        AS "surveyMobilPhoneNumber",
       non_or_setting_case_ind                           AS "nonOrSettingCaseInd",
       etco2_monitored_ind                               AS "etco2MonitoredInd",
       phenylephrine_admin_cd                            AS "phenylephrineAdminCd",
       labor_epidural_failure_ind                        AS "laborEpiduralFailureInd",
       primary_tka_ind                                   AS "primaryTkaInd",
       nerve_block_used_cd                               AS "nerveBlockUsedCd",
       shoulder_arthro_ind                               AS "shoulderArthroInd",
       upper_extremity_block_cd                          AS "upperExtremityBlockCd",
       elective_csection_ind                             AS "electiveCsectionInd",
       labor_epidural_converted_csection_ind             AS "laborEpiduralConvertedCsectionInd",
       prvr_cntrl_line_plcmt_ind                         AS "centralLinePlacedInd",
       cntrl_line_typ_cd                                 AS "centralLineTypCd",
       osa_screen_cd                                     AS "osaScreenCd",
       osa_mitigation_used_cd                            AS "osaMitigationUsedCd",
       hip_arthroplasty_ind                              AS "hipArthroplastyInd",
       shoulder_arthroplasty_ind                         AS "shoulderArthroplastyInd",
       shoulder_arthroscopy_ind                          AS "shoulderArthroscopyInd",
       anemia_screen_cd                                  AS "anemiaScreenCd",
       anemia_screen_pos_ind                             AS "anemiaScreenPosInd",
       dtu_anemia_management_cd                          AS "dtuAnemiaManagementCd",
       low_flow_maintenance_used_cd                       AS "lowFlowMaintenanceUsedCd",
       arterial_line_typ_cd                              AS "arterialLineTypCd",
       dtu_arterial_line_plcmt_cd                        AS "dtuArterialLinePlcmtCd",
       bypass_performed_ind                              AS "bypassPerformedInd",
       hypothermia_during_bypass_cd                      AS "hypothermiaDuringBypassCd",
       case_cancelled_time_spent_mins                    AS "caseCancelledTimeSpentMins",
       same_day_distinct_procedure_ind                   AS "sameDayDistinctProcedureInd",
       ama_cpt_license_ind                               AS "amaCptLicenseInd",
       qcdr_eval_survey_id                               AS "qcdrEvalSurveyId",
       qcdr_eval_survey_aud_ver                          AS "qcdrEvalSurveyAudVer"
  FROM cases
  LEFT JOIN comps
    ON comps.fac_id = cases.fac_id
   AND comps.enctr_form_id = cases.enctr_form_id
  LEFT JOIN cpts
    ON cpts.fac_id = cases.fac_id
   AND cpts.enctr_form_id = cases.enctr_form_id
  LEFT JOIN anes_prvrs
    ON anes_prvrs.fac_id = cases.fac_id
   AND anes_prvrs.enctr_form_id = cases.enctr_form_id
  LEFT JOIN prvr surgn
    ON surgn.prvr_id = cases.surgn_prvr_id
  LEFT JOIN nerve_blocks
    ON nerve_blocks.fac_id = cases.fac_id
   AND nerve_blocks.enctr_form_id = cases.enctr_form_id
 `;

    var queryOptions = {
        type: QueryTypes.SELECT,
        replacements: {
            facilityId: facilityId,
            encounterFormId: encounterFormId,
            currentEvalEngineVersion: currentEvalEngineVersion,
        },
    };

    if (!orgInternalName) {
        throw new Error('Missing parameter orgInternalName.');
    }

    let queryResult = await orgModels.query(orgInternalName, query, queryOptions);

    // extract Encounter Form Ids
    let encounterFormList = queryResult.map(function (encounterForm) {
        return encounterForm.encounterFormId;
    });

    // retrieve survey results for encounter forms
    let surveyResult = await GetSurveyResponsesForEncounterForms(
        orgInternalName,
        facilityId,
        'MACRA2020',
        encounterFormList,
    );

    //merge survey results by encounterFormId
    let queryResultWithSurveys:unknown = _(queryResult)
        .concat(surveyResult)
        .groupBy('encounterFormId')
        .map(_.spread(_.assign))
        .value();

    return <Get2023EncounterFormPendingQcdrCalculationResult[]>queryResultWithSurveys;
}

  export interface Get2024EncounterFormPendingQcdrCalculationResult {
      facilityId: number;
      encounterFormId: string;
      enctrNo: string;
      enctrPatMrn: string;
      formCmpltPct: string;
      formValidInd: boolean;
      enctrFormUpdDtUtc: Date;
      enctrFormUpdTmUtc: string;
      enctrFormAudVer: number;
      qcdrEvalEnctrFormVer: number;
      dateOfService: Date;
      patAgeYears: number;
      painScoreCd: string;
      xferLocnCd: string;
      caseCancelledInd: boolean;
      asaClsfnCd: string;
      asaEmergInd: boolean;
      difficultAirwayInd: boolean;
      plannedAirwayEquipUsedInd: boolean;
      compOrInd: boolean;
      anesStartTime: string;
      caseCancelledStgCd: string;
      multiModalPainMgmtCd: string;
      priorOsaDiagInd: boolean;
      patIncapacitatedInd: boolean;
      preopEvalOsaPosInd: boolean;
      osaEducationInd: boolean;
      osaMitigationUsedInd: boolean;
      patSmokeInd: boolean;
      patSmokeCessInd: boolean;
      patSmokeDosInd: boolean;
      maintInhAgentUsedInd: boolean;
      ponvHighRiskInd: boolean;
      combTherCd: string;
      importResult: any;
      hasDateOfService: boolean;
      hasAnesthesiaProvider: boolean;
      surgeonNpi: string;
      anesProvidersList: any;
      allCptCodes: any;
      allCptCnt: number;
      compList: any;
      compCnt: number;
      postDischStatusAssessedCd: string;
      primaryAnesthetic: string;
      anesthesiaStartDateTime: Date;
      anesthesiaEndDateTime: Date;
      patientBodyTemp: number;
      nerveBlockInd: boolean;
      secondProviderDiffAirwayInd: boolean;
      sendSurveyCd: string;
      surveyEmailAddress: string;
      surveyMobilPhoneNumber: string;
      nonOrSettingCaseInd: boolean;
      etco2MonitoredInd: boolean;
      phenylephrineAdminCd: string;
      laborEpiduralFailureInd: boolean;
      primaryTkaInd: boolean;
      nerveBlockUsedCd: string;
      shoulderArthroInd: boolean;
      upperExtremityBlockCd: string;
      electiveCsectionInd: boolean;
      laborEpiduralConvertedCsectionInd: boolean;
      centralLinePlacedInd: boolean;
      centralLineTypCd: string;
      osaScreenCd: string;
      osaMitigationUsedCd: string;
      hipArthroplastyInd: boolean;
      shoulderArthroplastyInd: boolean;
      shoulderArthroscopyInd: boolean;
      anemiaScreenCd: string;
      anemiaScreenPosInd: boolean;
      dtuAnemiaManagementCd: string;
      lowFlowMaintenanceUsedCd: string;
      arterialLineTypCd: string;
      dtuArterialLinePlcmtCd: string;
      bypassPerformedInd: boolean;
      hypothermiaDuringBypassCd: string;
      totalJointArthoplastyInd: boolean;
      diabetesDiagnosisInd: boolean;
      bgTestPriorToAnesthesiaInd: boolean;
      bgGt180Ind: boolean;
      recvdInsulinPriorToAnesEndCd: string;
      glucCheckAfterInsulinPriorToDischargeInd: boolean;
      recvdGlucMgmtEducationInd: boolean;
      frailtyScreenPosInd: boolean;
      recvdMultidisciplinaryConsultInd: boolean;
      isolatedCabgInd: boolean;
      postopIntubGt24hrsReqdInd: boolean;
      allIcdCmCodes: any;
      allIcdCmCnt: number;
      patTypCd: string;
      qcdrPassthroughData: string;
      qcdrPassthroughCaseInd: boolean;
      caseCancelledTimeSpentMins: number;
      sameDayDistinctProcedureInd: boolean;
      amaCptLicenseInd: boolean;
      qcdrEvalSurveyId: number;
      qcdrEvalSurveyAudVer: number;
      surveyGuid: string;
      surveyStateCode: string;
      surveySentTimestamp: string;
      surveyResponseReceviedTimestamp: string;
      surveyResponseData: string;
  }

  export async function get2024QcdrFormFacts(
      orgInternalName: string,
      facilityId: number,
      currentEvalEngineVersion: string,
      onlyFormsPendingCalculation: boolean = true,
      encounterFormId?: number,
  ): Promise<Get2024EncounterFormPendingQcdrCalculationResult[]> {
      var query = `
WITH cases AS ( /* class@PQRSAnalyticsDAO.get2024QcdrFormFacts */
   SELECT e.fac_id,
          ef.enctr_form_id,
          e.enctr_no,
          e.pat_mrn AS enctr_pat_mrn,
          ef.form_cmplt_pct,
          ef.form_valid_ind,
          DATE(ef.upd_dttm AT TIME ZONE 'UTC') AS enctr_form_upd_dt_utc,
          CAST(ef.upd_dttm AT TIME ZONE 'UTC' AS TIME) AS enctr_form_upd_tm_utc,
          efs.aud_ver AS enctr_form_aud_ver,
          efs.qcdr_eval_enctr_form_ver,
          efs.proc_dt,
          CAST(efs.surgn_prvr_id AS BIGINT) AS surgn_prvr_id,
          CAST(DATE_PART('year',AGE(efs.proc_dt,COALESCE(efs.pat_dob,e.pat_dob))) AS INT) AS pat_age_years,
          efs.pacu_pain_score_cd,
          efs.prim_anes_typ_cd,
          efs.preop_eval_osa_cd,
          efs.xfer_locn_cd,
          COALESCE(efs.case_cancelled_ind,FALSE) AS case_cancelled_ind,
          efs.asa_clsfn_cd,
          efs.asa_emerg_ind,
          efs.difficult_airway_ind,
          efs.planned_airway_equip_used_ind,
          efs.comp_or_ind,
          efs.anes_st_tm,
          efs.case_cancelled_stg_cd,
          efs.multi_modal_pain_mgmt_cd,
          efs.prior_osa_diag_ind,
          efs.pat_incapacitated_ind ,
          efs.preop_eval_osa_pos_ind,
          efs.osa_education_ind,
          efs.osa_mitigation_used_ind,
          efs.pat_smoke_ind,
          efs.pat_smoke_cess_ind,
          efs.pat_smoke_dos_ind,
          efs.maint_inh_agent_used_ind,
          efs.ponv_high_risk_ind,
          efs.comb_ther_cd,
          efs.post_disch_status_assessed_cd,
          efs.second_prvr_da_indctd_ind,
          efs.send_survey_cd,
          efs.survey_email_address,
          efs.survey_mobile_phone_number,
          efs.non_or_setting_case_ind,
          efs.etco2_monitored_ind,
          efs.phenylephrine_admin_cd,
          efs.labor_epidural_failure_ind,
          efs.primary_tka_ind,
          efs.nerve_block_used_cd,
          efs.shoulder_arthro_ind,
          efs.upper_extremity_block_cd,
          efs.elective_csection_ind,
          efs.labor_epidural_converted_csection_ind,
          efs.prvr_cntrl_line_plcmt_ind,
          efs.cntrl_line_typ_cd,
          efs.osa_screen_cd,
          efs.osa_mitigation_used_cd,
          efs.hip_arthroplasty_ind,
          efs.shoulder_arthroplasty_ind,
          efs.shoulder_arthroscopy_ind,
          efs.anemia_screen_cd,
          efs.anemia_screen_pos_ind,
          efs.dtu_anemia_management_cd,
          efs.low_flow_maintenance_used_cd,
          efs.arterial_line_typ_cd,
          efs.dtu_arterial_line_plcmt_cd,
          efs.bypass_performed_ind,
          efs.hypothermia_during_bypass_cd,
          efs.total_joint_arthoplasty_ind,
          efs.diabetes_diagnosis_ind,
          efs.bg_test_prior_to_anesthesia_ind,
          efs.bg_gt_180_ind,
          efs.recvd_insulin_prior_to_anes_end_cd,
          efs.gluc_check_after_insulin_prior_to_discharge_ind,
          efs.recvd_gluc_mgmt_education_ind,
          efs.frailty_screen_pos_ind,
          efs.recvd_multidisciplinary_consult_ind,
          efs.isolated_cabg_ind,
          efs.postop_intub_gt_24hrs_reqd_ind,
          efs.pat_typ_cd,
          efs.qcdr_passthrough_data,
          COALESCE(efs.qcdr_passthrough_case_ind,FALSE) AS qcdr_passthrough_case_ind,
          efs.case_cancelled_time_spent_mins,
          efs.same_day_distinct_procedure_ind,
          efs.ama_cpt_license_ind,
          efs.qcdr_eval_survey_id,
          efs.qcdr_eval_survey_aud_ver,
          (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
          (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm,
          CASE
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                -- treat value as Fahrenheit and convert to Celsius
                ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
             WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                -- treat value as Celsius
                efs.pat_body_temp
             ELSE NULL
          END AS pat_body_temp,
          efs.import_result
     FROM enctr e
     JOIN enctr_form ef
       ON ef.enctr_id = e.enctr_id
      AND ef.void_ind IS NOT DISTINCT FROM FALSE
     JOIN form_defn fd
       ON fd.form_defn_id = ef.form_defn_id
     JOIN enctr_form_surgery efs
       ON efs.enctr_form_id = ef.enctr_form_id
    WHERE e.fac_id = :facilityId
      AND efs.proc_dt IS NOT NULL
      AND efs.proc_dt BETWEEN '2024-01-01' AND '2024-12-31'
  `;
      if (onlyFormsPendingCalculation) {
          query += `
      /* only include forms needing updated QCDR results */
      AND (-- 1. form has been updated since last QCDR evaluation
           COALESCE(efs.qcdr_eval_enctr_form_ver,0) < efs.aud_ver OR
           -- 2. rules engine logic has been updated
           COALESCE(qcdr_eval_result::JSON->>'qcdrVersion','') <> :currentEvalEngineVersion OR
           -- 3. a MACRA2020 survey for the form has been added or updated
           EXISTS (WITH surveys AS (
                      SELECT jsonb_array_elements(ef.enctr_form_surveys) AS survey
                   )
                   SELECT 1
                     FROM surveys
                    WHERE survey->>'survey_code' = 'MACRA2020'
                      AND COALESCE((survey->>'survey_aud_ver')::BIGINT,0) <> COALESCE(efs.qcdr_eval_survey_aud_ver,0)
                  )
          )
    `;
      }

      if (encounterFormId) {
          query += `
      /* only a specific encounter form */
      AND ef.enctr_form_id = :encounterFormId
    `;
      }

      query += `
),
comps AS (
   SELECT c.fac_id,
          c.enctr_form_id,
          ARRAY_AGG(comp_nm) AS comp_list
     FROM rpt_comp_pivot_v v
     JOIN cases c
       ON c.fac_id = v.fac_id
      AND c.enctr_form_id = v.enctr_form_id
    WHERE comp_ind = 1
    GROUP BY c.fac_id,
             c.enctr_form_id
),
cpts AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_AGG(DISTINCT cpt_cd) AS cpt_list,
          COUNT(DISTINCT cpt_cd) AS cpt_cnt
     FROM (SELECT c.fac_id,
                  c.enctr_form_id,
                  psd.prop_val AS cpt_cd
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{asa_proc_cd,anes_proc_cd,cpt_proc_cd,recon_cpt_cd}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) cpt_list
    GROUP BY fac_id,
             enctr_form_id
),
icdcms AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_AGG(DISTINCT icd_cm_cd) AS icd_cm_list,
          COUNT(DISTINCT icd_cm_cd) AS icd_cm_cnt
     FROM (SELECT c.fac_id,
                  c.enctr_form_id,
                  psd.prop_val AS icd_cm_cd
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{icd_cm_diag_cd}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) icd_cm_list
    GROUP BY fac_id,
             enctr_form_id
),
nerve_blocks AS (
    SELECT fac_id,
           enctr_form_id,
           COUNT(*) AS cpt_cnt
      FROM (SELECT c.fac_id,
                   c.enctr_form_id,
                   psd.prop_val AS cpt_cd
              FROM page_surgery_dtl psd
              JOIN page_surgery ps
                ON ps.page_id = psd.page_id
              JOIN cases c
                ON c.enctr_form_id = ps.enctr_form_id
             WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_proc_sdesc}' AS TEXT[])))
               AND psd.prop_seq IN (4,5)
               AND psd.prop_val IS NOT NULL) cpt_list
     GROUP BY fac_id,
              enctr_form_id
),
anes_prvrs AS (
   SELECT fac_id,
          enctr_form_id,
          ARRAY_TO_STRING(ARRAY_AGG(anes_prvr_npi),'|') AS anes_prvrs_list,
          COUNT(DISTINCT anes_prvr_npi) AS anes_prvr_cnt
     FROM (SELECT p.fac_id,
                  c.enctr_form_id,
                  p.natl_prvr_id AS anes_prvr_npi
             FROM page_surgery_dtl psd
             JOIN page_surgery ps
               ON ps.page_id = psd.page_id
             JOIN cases c
               ON c.enctr_form_id = ps.enctr_form_id
             JOIN prvr p
               ON p.prvr_id = CAST(psd.prop_val AS BIGINT)
            WHERE (CAST(psd.prop_nm AS TEXT) = ANY (CAST('{anes_prvr_id}' AS TEXT[])))
              AND psd.prop_val IS NOT NULL) anes_staff
    GROUP BY fac_id,
             enctr_form_id
)
SELECT cases.fac_id                                      AS "facilityId",
       cases.enctr_form_id                               AS "encounterFormId",
       enctr_no                                          AS "enctrNo",
       enctr_pat_mrn                                     AS "enctrPatMrn",
       form_cmplt_pct                                    AS "formCmpltPct",
       form_valid_ind                                    AS "formValidInd",
       enctr_form_upd_dt_utc                             AS "enctrFormUpdDtUtc",
       enctr_form_upd_tm_utc                             AS "enctrFormUpdTmUtc",
       enctr_form_aud_ver                                AS "enctrFormAudVer",
       qcdr_eval_enctr_form_ver                          AS "qcdrEvalEnctrFormVer",
       proc_dt                                           AS "dateOfService",
       pat_age_years                                     AS "patAgeYears",
       pacu_pain_score_cd                                AS "painScoreCd",
       xfer_locn_cd                                      AS "xferLocnCd",
       case_cancelled_ind                                AS "caseCancelledInd",
       asa_clsfn_cd                                      AS "asaClsfnCd",
       cases.asa_emerg_ind                               AS "asaEmergInd",
       difficult_airway_ind                               AS "difficultAirwayInd",
       planned_airway_equip_used_ind                     AS "plannedAirwayEquipUsedInd",
       comp_or_ind                                       AS "compOrInd",
       anes_st_tm                                        AS "anesStartTime",
       case_cancelled_stg_cd                             AS "caseCancelledStgCd",
       multi_modal_pain_mgmt_cd                          AS "multiModalPainMgmtCd",
       prior_osa_diag_ind                                AS "priorOsaDiagInd",
       pat_incapacitated_ind                             AS "patIncapacitatedInd",
       preop_eval_osa_pos_ind                            AS "preopEvalOsaPosInd",
       osa_education_ind                                 AS "osaEducationInd",
       osa_mitigation_used_ind                           AS "osaMitigationUsedInd",
       pat_smoke_ind                                     AS "patSmokeInd",
       pat_smoke_cess_ind                                AS "patSmokeCessInd",
       pat_smoke_dos_ind                                 AS "patSmokeDosInd",
       maint_inh_agent_used_ind                          AS "maintInhAgentUsedInd",
       ponv_high_risk_ind                                AS "ponvHighRiskInd",
       comb_ther_cd                                      AS "combTherCd",
       import_result                                     AS "importResult",
       CASE
          WHEN proc_dt IS NOT NULL THEN TRUE
          ELSE FALSE
       END                                               AS "hasDateOfService",
       CASE
          WHEN anes_prvrs.anes_prvr_cnt >= 1 THEN TRUE
          ELSE FALSE
       END                                               AS "hasAnesthesiaProvider",
       COALESCE(surgn.natl_prvr_id,'UNKNOWN')            AS "surgeonNpi",
       anes_prvrs.anes_prvrs_list                        AS "anesProvidersList",
       cpts.cpt_list                                     AS "allCptCodes",
       COALESCE(cpts.cpt_cnt,0)                          AS "allCptCnt",
       comps.comp_list                                   AS "compList",
       COALESCE(ARRAY_LENGTH(comps.comp_list,1),0)       AS "compCnt",
       post_disch_status_assessed_cd                     AS "postDischStatusAssessedCd",
       prim_anes_typ_cd                                  AS "primaryAnesthetic",
       anes_st_dttm                                      AS "anesthesiaStartDateTime",
       anes_end_dttm                                     AS "anesthesiaEndDateTime",
       pat_body_temp                                     AS "patientBodyTemp",
       CASE
          WHEN nerve_blocks.cpt_cnt IS NOT NULL AND
               nerve_blocks.cpt_cnt > 0 THEN TRUE
          ELSE FALSE
       END                                               AS "nerveBlockInd",
       second_prvr_da_indctd_ind                         AS "secondProviderDiffAirwayInd",
       send_survey_cd                                    AS "sendSurveyCd",
       survey_email_address                              AS "surveyEmailAddress",
       survey_mobile_phone_number                        AS "surveyMobilPhoneNumber",
       non_or_setting_case_ind                           AS "nonOrSettingCaseInd",
       etco2_monitored_ind                               AS "etco2MonitoredInd",
       phenylephrine_admin_cd                            AS "phenylephrineAdminCd",
       labor_epidural_failure_ind                        AS "laborEpiduralFailureInd",
       primary_tka_ind                                   AS "primaryTkaInd",
       nerve_block_used_cd                               AS "nerveBlockUsedCd",
       shoulder_arthro_ind                               AS "shoulderArthroInd",
       upper_extremity_block_cd                          AS "upperExtremityBlockCd",
       elective_csection_ind                             AS "electiveCsectionInd",
       labor_epidural_converted_csection_ind             AS "laborEpiduralConvertedCsectionInd",
       prvr_cntrl_line_plcmt_ind                         AS "centralLinePlacedInd",
       cntrl_line_typ_cd                                 AS "centralLineTypCd",
       osa_screen_cd                                     AS "osaScreenCd",
       osa_mitigation_used_cd                            AS "osaMitigationUsedCd",
       hip_arthroplasty_ind                              AS "hipArthroplastyInd",
       shoulder_arthroplasty_ind                         AS "shoulderArthroplastyInd",
       shoulder_arthroscopy_ind                          AS "shoulderArthroscopyInd",
       anemia_screen_cd                                  AS "anemiaScreenCd",
       anemia_screen_pos_ind                             AS "anemiaScreenPosInd",
       dtu_anemia_management_cd                          AS "dtuAnemiaManagementCd",
       low_flow_maintenance_used_cd                       AS "lowFlowMaintenanceUsedCd",
       arterial_line_typ_cd                              AS "arterialLineTypCd",
       dtu_arterial_line_plcmt_cd                        AS "dtuArterialLinePlcmtCd",
       bypass_performed_ind                              AS "bypassPerformedInd",
       hypothermia_during_bypass_cd                      AS "hypothermiaDuringBypassCd",
       total_joint_arthoplasty_ind                       AS "totalJointArthoplastyInd",
       diabetes_diagnosis_ind                            AS "diabetesDiagnosisInd",
       bg_test_prior_to_anesthesia_ind                   AS "bgTestPriorToAnesthesiaInd",
       bg_gt_180_ind                                     AS "bgGt180Ind",
       recvd_insulin_prior_to_anes_end_cd                AS "recvdInsulinPriorToAnesEndCd",
       gluc_check_after_insulin_prior_to_discharge_ind   AS "glucCheckAfterInsulinPriorToDischargeInd",
       recvd_gluc_mgmt_education_ind                     AS "recvdGlucMgmtEducationInd",
       frailty_screen_pos_ind                            AS "frailtyScreenPosInd",
       recvd_multidisciplinary_consult_ind               AS "recvdMultidisciplinaryConsultInd",
       isolated_cabg_ind                                 AS "isolatedCabgInd",
       postop_intub_gt_24hrs_reqd_ind                    AS "postopIntubGt24hrsReqdInd",
       icdcms.icd_cm_list                                AS "allIcdCmCodes",
       COALESCE(icdcms.icd_cm_cnt,0)                     AS "allIcdCmCnt",
       pat_typ_cd                                        AS "patTypCd",
       qcdr_passthrough_data                             AS "qcdrPassthroughData",
       qcdr_passthrough_case_ind                         AS "qcdrPassthroughCaseInd",
       case_cancelled_time_spent_mins                    AS "caseCancelledTimeSpentMins",
       same_day_distinct_procedure_ind                   AS "sameDayDistinctProcedureInd",
       ama_cpt_license_ind                               AS "amaCptLicenseInd",
       qcdr_eval_survey_id                               AS "qcdrEvalSurveyId",
       qcdr_eval_survey_aud_ver                          AS "qcdrEvalSurveyAudVer"
  FROM cases
  LEFT JOIN comps
    ON comps.fac_id = cases.fac_id
   AND comps.enctr_form_id = cases.enctr_form_id
  LEFT JOIN cpts
    ON cpts.fac_id = cases.fac_id
   AND cpts.enctr_form_id = cases.enctr_form_id
  LEFT JOIN icdcms
    ON icdcms.fac_id = cases.fac_id
   AND icdcms.enctr_form_id = cases.enctr_form_id
  LEFT JOIN anes_prvrs
    ON anes_prvrs.fac_id = cases.fac_id
   AND anes_prvrs.enctr_form_id = cases.enctr_form_id
  LEFT JOIN prvr surgn
    ON surgn.prvr_id = cases.surgn_prvr_id
  LEFT JOIN nerve_blocks
    ON nerve_blocks.fac_id = cases.fac_id
   AND nerve_blocks.enctr_form_id = cases.enctr_form_id
 `;

      var queryOptions = {
          type: QueryTypes.SELECT,
          replacements: {
              facilityId: facilityId,
              encounterFormId: encounterFormId,
              currentEvalEngineVersion: currentEvalEngineVersion,
          },
      };

      if (!orgInternalName) {
          throw new Error('Missing parameter orgInternalName.');
      }

      let queryResult = await orgModels.query(orgInternalName, query, queryOptions);

      // extract Encounter Form Ids
      let encounterFormList = queryResult.map(function (encounterForm) {
          return encounterForm.encounterFormId;
      });

      // retrieve survey results for encounter forms
      let surveyResult = await GetSurveyResponsesForEncounterForms(
          orgInternalName,
          facilityId,
          'MACRA2020',
          encounterFormList,
      );

      //merge survey results by encounterFormId
      let queryResultWithSurveys:unknown = _(queryResult)
          .concat(surveyResult)
          .groupBy('encounterFormId')
          .map(_.spread(_.assign))
          .value();

      return <Get2024EncounterFormPendingQcdrCalculationResult[]>queryResultWithSurveys;
  }