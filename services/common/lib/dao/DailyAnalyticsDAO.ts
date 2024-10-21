import { QueryTypes } from 'sequelize';
import * as _ from 'lodash';
import * as orgModels from '../model/OrgModels.js';

export interface DailyAnalyticsReportData {
  totalCases: number,
  totalAnesthesiaMinutes: number,
  anesthesiaTot: number,
  icuAdmissions: number,
  pacuAdmissions: number,
  generalCases: number,
  macCases: number,
  regionalCases: number,
  neuraxialCases: number,
  laborEpiduralCases: number,
  totalComplications: number,
  hypothermicPatients: number,
  safetyChecklistUsedPerc: number,
  handoffProtocolUsedPerc: number,
  locationUtilizationData: number
}

export async function getAllReports(orgInternalName:string, facilityId:number, dateOfService:string):Promise<DailyAnalyticsReportData> {
  let data:DailyAnalyticsReportData = {
    totalCases: null,
    totalAnesthesiaMinutes: null,
    anesthesiaTot: null,
    icuAdmissions: null,
    pacuAdmissions: null,
    generalCases: null,
    macCases: null,
    regionalCases: null,
    neuraxialCases: null,
    laborEpiduralCases: null,
    totalComplications: null,
    hypothermicPatients: null,
    safetyChecklistUsedPerc: null,
    handoffProtocolUsedPerc: null,
    locationUtilizationData: null
  };

  data.totalCases = await getTotalAnesthesiaCases(orgInternalName,facilityId,dateOfService);
  data.totalAnesthesiaMinutes = await getTotalAnesthesiaMinutes(orgInternalName,facilityId,dateOfService);
  data.anesthesiaTot = await getAnesthesiaTot(orgInternalName,facilityId,dateOfService);
  data.icuAdmissions = await getIcuAdmissions(orgInternalName,facilityId,dateOfService);
  data.pacuAdmissions = await getPacuAdmissions(orgInternalName,facilityId,dateOfService);
  data.generalCases = await getGeneralCases(orgInternalName,facilityId,dateOfService);
  data.macCases = await getMacCases(orgInternalName,facilityId,dateOfService);
  data.regionalCases = await getRegionalCases(orgInternalName,facilityId,dateOfService);
  data.neuraxialCases = await getNeuraxialCases(orgInternalName,facilityId,dateOfService);
  data.laborEpiduralCases = await getLaborEpiduralCases(orgInternalName,facilityId,dateOfService);
  data.totalComplications = await getTotalComplications(orgInternalName,facilityId,dateOfService);
  data.hypothermicPatients = await getHypothermicCases(orgInternalName,facilityId,dateOfService);
  data.safetyChecklistUsedPerc = await getSafetyChecklistUsedPerc(orgInternalName,facilityId,dateOfService);
  data.handoffProtocolUsedPerc = await getHandoffProtocolUsedPerc(orgInternalName,facilityId,dateOfService);
  data.locationUtilizationData = await getLocationUtilizationData(orgInternalName,facilityId,dateOfService);

  return data;
}


async function getTotalAnesthesiaCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
    let query = `WITH cases AS (
      SELECT COUNT(*) AS cnt
        FROM enctr_form_surgery efs
        JOIN enctr_form ef
          ON ef.enctr_form_id = efs.enctr_form_id
         AND ef.void_ind IS DISTINCT FROM TRUE
        JOIN enctr e
          ON e.enctr_id = ef.enctr_id
         AND e.fac_id = :facilityId
         AND e.purged_ind IS DISTINCT FROM TRUE
        JOIN form_defn fd
          ON fd.form_defn_id = ef.form_defn_id
         AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
       WHERE efs.proc_dt = :dateOfService
             /* filter out cases cancelled pre-induction */
         AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                  (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
   )
   SELECT cnt AS "metric"
     FROM cases;`;

    let queryOptions = {
      type: QueryTypes.SELECT,
      replacements: {
        facilityId: facilityId,
        dateOfService: dateOfService
      }
    }

    let results = await orgModels.query(orgInternalName, query, queryOptions);
    return parseInt(results[0].metric);
}

async function getTotalAnesthesiaMinutes(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
           (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
 )
 SELECT ROUND(SUM(EXTRACT(EPOCH FROM ((anes_end_dttm - anes_st_dttm)/60)))) AS "metric"
   FROM cases
  WHERE anes_end_dttm IS NOT NULL
    AND anes_st_dttm IS NOT NULL
    AND anes_end_dttm >= anes_st_dttm;
 `;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getAnesthesiaTot(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT efs.enctr_form_id,
            efs.surgn_prvr_id,
            efs.proc_dt,
            efs.locn_cd,
            (COALESCE(efs.anes_st_dt,efs.proc_dt) + efs.anes_st_tm) AS anes_st_dttm,
            (COALESCE(efs.anes_end_dt,COALESCE(efs.proc_end_dt,efs.proc_dt)) + efs.anes_end_tm) AS anes_end_dttm
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
        AND efs.surgn_prvr_id IS NOT NULL
  ),
  nxt AS (
     SELECT enctr_form_id,
            proc_dt,
            surgn_prvr_id,
            anes_st_dttm,
            anes_end_dttm,
            LEAD(surgn_prvr_id) OVER (PARTITION BY proc_dt, surgn_prvr_id, locn_cd ORDER BY proc_dt, surgn_prvr_id, locn_cd, anes_st_dttm) nxt_surgn_prvr_id,
            LEAD(anes_st_dttm) OVER (PARTITION BY proc_dt, surgn_prvr_id, locn_cd ORDER BY proc_dt, surgn_prvr_id, locn_cd, anes_st_dttm) nxt_anes_st_tm
       FROM cases
      WHERE anes_end_dttm IS NOT NULL
        AND anes_st_dttm IS NOT NULL
        AND anes_end_dttm >= anes_st_dttm
  ),
  tot AS (
     SELECT proc_dt,
            surgn_prvr_id,
            SUM(EXTRACT(EPOCH FROM ((nxt_anes_st_tm - anes_end_dttm)/60))) AS anes_tot,
            COUNT(*) AS anes_cnt
       FROM nxt
      WHERE surgn_prvr_id = nxt_surgn_prvr_id
        AND nxt_anes_st_tm > anes_end_dttm  /* ensure overlapping cases (which are anomalies) are not included in the TOT calculation */
        AND (nxt_anes_st_tm - anes_end_dttm) < INTERVAL '90 minutes'
      GROUP BY 1,2
  )
  SELECT ROUND(CAST(AVG(anes_tot/anes_cnt) AS NUMERIC),1) AS "metric"
    FROM tot;
  `;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseFloat(results[0].metric ? results[0].metric.toString() : null);
}

async function getIcuAdmissions(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT COUNT(*) AS cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
       AND efs.xfer_locn_cd = 'ICU'
 )
 SELECT cnt AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}


async function getPacuAdmissions(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT COUNT(*) AS cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
       AND efs.xfer_locn_cd = 'PACU'
 )
 SELECT cnt AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getGeneralCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT COUNT(*) AS cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
       AND efs.prim_anes_typ_cd = 'GENERAL'
 )
 SELECT cnt AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}


async function getMacCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT COUNT(*) AS cnt
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
        AND efs.prim_anes_typ_cd = 'MAC'
  )
  SELECT cnt AS "metric"
    FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getRegionalCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT COUNT(*) AS cnt
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
        AND efs.prim_anes_typ_cd = 'REGIONAL'
  )
  SELECT cnt AS "metric"
    FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getNeuraxialCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT COUNT(*) AS cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
       AND efs.prim_anes_typ_cd IN ('SPINAL','EPIDURAL')
 )
 SELECT cnt AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getLaborEpiduralCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT COUNT(*) AS cnt
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
        AND efs.prim_anes_typ_cd = 'LABOR_EPIDURAL'
  )
  SELECT cnt AS "metric"
    FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getTotalComplications(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT efs.enctr_form_id
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
  ),
  comps AS (
     SELECT ps.enctr_form_id,
            ps.page_id,
            psd.prop_seq,
            MAX(CASE WHEN prop_nm = 'comp_nm' THEN prop_val::VARCHAR ELSE NULL END) AS comp_nm,
            MAX(CASE WHEN prop_nm = 'comp_ind' THEN CAST(prop_val AS BOOLEAN)::INTEGER ELSE NULL END) AS comp_ind
       FROM page_surgery_dtl psd
       JOIN page_surgery ps
         ON ps.page_id = psd.page_id
       JOIN cases c
         ON c.enctr_form_id = ps.enctr_form_id
      WHERE psd.prop_nm IN ('comp_nm','comp_ind')
        AND psd.prop_val IS NOT NULL
      GROUP BY ps.enctr_form_id,
               ps.page_id,
               psd.prop_seq
  )
  SELECT COUNT(*) AS "metric"
    FROM cases
    JOIN comps
      ON comps.enctr_form_id = cases.enctr_form_id
     AND comp_ind = 1;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}

async function getHypothermicCases(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
     SELECT efs.enctr_form_id,
            CASE
                 WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp > 50 THEN
                    -- treat value as Fahrenheit and convert to Celsius
                    ROUND(CAST((efs.pat_body_temp - 32.0) * (5.0/9.0) AS NUMERIC),2)
                 WHEN efs.pat_body_temp IS NOT NULL AND efs.pat_body_temp <= 50 THEN
                    -- treat value as Celsius
                    efs.pat_body_temp
                 ELSE NULL
              END AS pat_body_temp
       FROM enctr_form_surgery efs
       JOIN enctr_form ef
         ON ef.enctr_form_id = efs.enctr_form_id
        AND ef.void_ind IS DISTINCT FROM TRUE
       JOIN enctr e
         ON e.enctr_id = ef.enctr_id
        AND e.fac_id = :facilityId
        AND e.purged_ind IS DISTINCT FROM TRUE
       JOIN form_defn fd
         ON fd.form_defn_id = ef.form_defn_id
        AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
      WHERE efs.proc_dt = :dateOfService
            /* filter out cases cancelled pre-induction */
        AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                 (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
  ),
  comps AS (
     SELECT ps.enctr_form_id,
            ps.page_id,
            psd.prop_seq,
            MAX(CASE WHEN prop_nm = 'comp_nm' THEN prop_val::VARCHAR ELSE NULL END) AS comp_nm,
            MAX(CASE WHEN prop_nm = 'comp_ind' THEN CAST(prop_val AS BOOLEAN)::INTEGER ELSE NULL END) AS comp_ind
       FROM page_surgery_dtl psd
       JOIN page_surgery ps
         ON ps.page_id = psd.page_id
       JOIN cases c
         ON c.enctr_form_id = ps.enctr_form_id
      WHERE psd.prop_nm IN ('comp_nm','comp_ind')
        AND psd.prop_val IS NOT NULL
      GROUP BY ps.enctr_form_id,
               ps.page_id,
               psd.prop_seq
  ),
  hypo AS (
     SELECT enctr_form_id,
            COUNT(*) AS hypo_cnt
       FROM comps
      WHERE comp_nm = 'pacu_hypotherm'
        AND comp_ind = 1
      GROUP BY enctr_form_id
  )
  SELECT COUNT(*) AS "metric"
    FROM cases
    LEFT JOIN hypo
      ON hypo.enctr_form_id = cases.enctr_form_id
   WHERE COALESCE(hypo_cnt,0) > 0
      OR (pat_body_temp IS NOT NULL AND pat_body_temp < 36.0);`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseInt(results[0].metric ? results[0].metric.toString() : null);
}


async function getSafetyChecklistUsedPerc(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT SUM(CASE WHEN surg_safety_chklst_used_ind IS NOT DISTINCT FROM TRUE THEN 1 ELSE 0 END) AS numerator_cnt,
           COUNT(*) AS denominator_cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
 )
 SELECT ROUND((numerator_cnt::decimal/denominator_cnt::decimal)*100,2) AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseFloat(results[0].metric ? results[0].metric.toString() : null);
}

async function getHandoffProtocolUsedPerc(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT SUM(CASE WHEN xfer_proto_usage_cd IN ('Y','N-RS') THEN 1 ELSE 0 END) AS numerator_cnt,
           COUNT(*) AS denominator_cnt
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
 )
 SELECT ROUND((numerator_cnt::decimal/denominator_cnt::decimal)*100,2) AS "metric"
   FROM cases;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return parseFloat(results[0].metric ? results[0].metric.toString() : null);
}

async function getLocationUtilizationData(orgInternalName:string, facilityId:number, dateOfService:string):Promise<any> {
  let query = `WITH cases AS (
    SELECT efs.proc_dt,
           efs.locn_cd,
           efs.anes_st_tm,
           efs.anes_end_tm
      FROM enctr_form_surgery efs
      JOIN enctr_form ef
        ON ef.enctr_form_id = efs.enctr_form_id
       AND ef.void_ind IS DISTINCT FROM TRUE
      JOIN enctr e
        ON e.enctr_id = ef.enctr_id
       AND e.fac_id = :facilityId
       AND e.purged_ind IS DISTINCT FROM TRUE
      JOIN form_defn fd
        ON fd.form_defn_id = ef.form_defn_id
       AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE
     WHERE efs.proc_dt = :dateOfService
           /* filter out cases cancelled pre-induction */
       AND NOT (efs.case_cancelled_ind IS NOT DISTINCT FROM TRUE AND
                (efs.anes_st_tm IS NULL OR efs.case_cancelled_stg_cd = 'BI'))
 ),
 block_time AS (
    SELECT blk, blk_time, blk_time_plus10, blk_time_minus10
      FROM rpt_block_time_v
 ),
 day_counts AS (
    SELECT COUNT(DISTINCT proc_dt) AS day_cnt
      FROM cases
 ),
 util AS (
    SELECT blk,
           proc_dt,
           CASE
              -- handle cases that span midnight (basically ignore logic that evaluates anes_end_dttm)
              WHEN (anes_end_tm < anes_st_tm) AND
                   (/* case is ongoing at top of hour */
                    ((anes_st_tm <= blk_time)) OR
                    /* case ends within 10 minutes of top of hour */
                    ((anes_st_tm < blk_time)) OR
                    /* case starts within 10 minutes of top of hour */
                    ((anes_st_tm > blk_time) AND (anes_st_tm <= blk_time_plus10))
                   ) THEN locn_cd
              -- handle normal cases that DO NOT span midnight
              WHEN (anes_end_tm >= anes_st_tm) AND
                   (/* case is ongoing at top of hour */
                    ((anes_st_tm <= blk_time) AND (anes_end_tm >= blk_time)) OR
                    /* case ends within 10 minutes of top of hour */
                    ((anes_st_tm < blk_time) AND (anes_end_tm >= blk_time_minus10) AND (anes_end_tm < blk_time)) OR
                    /* case starts within 10 minutes of top of hour */
                    ((anes_st_tm > blk_time) AND (anes_st_tm <= blk_time_plus10))
                   ) THEN locn_cd
              ELSE NULL
           END AS locn_cd
      FROM cases
      JOIN block_time
        ON 1=1
 ),
 locs AS (
    SELECT util.blk,
           util.proc_dt,
           COUNT(DISTINCT util.locn_cd) as locn_cnt
      FROM util
     GROUP BY util.blk,
              util.proc_dt
 )
 SELECT locs.blk,
        ROUND(CAST((SUM(locn_cnt)/day_counts.day_cnt) AS NUMERIC),1) AS locn_cnt
   FROM locs
   JOIN day_counts
     ON 1=1
  GROUP BY locs.blk,
           day_counts.day_cnt;`;

  let queryOptions = {
    type: QueryTypes.SELECT,
    replacements: {
      facilityId: facilityId,
      dateOfService: dateOfService
    }
  }

  let results = await orgModels.query(orgInternalName, query, queryOptions);
  return results;
}