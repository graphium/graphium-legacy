import * as OrgModels from '../model/OrgModels';
import * as PqrsAnalyticsDAO from '../dao/PQRSAnalyticsDAO';
import * as ImportBatchDAO from '../dao/ImportBatchDAO';
import * as OrgUserDAO from '../dao/org/OrgUserDAO';
import * as ProviderDAO from '../dao/org/ProviderDAO';
import * as OrganizationDAO from '../dao/org/FacilityDAO';
import * as IndexOrganizationDAO from '../dao/index/IndexOrganizationDAO';
import * as ImportAnalyticsDAO from '../dao/ImportAnalyticsDAO';
import * as DataEntryAnalyticsDAO from '../dao/analytics/DataEntryAnalyticsDAO';
import * as FacilityDAO from '../dao/org/FacilityDAO';

import * as es from '../util/esUtil';
import * as Elasticsearch from 'elasticsearch';
import * as moment from 'moment';
import Sequelize from 'sequelize';
import * as _ from 'lodash';
import Facility from '../model/flow/Facility';

interface DataEntryCountByMonthAndFacility {
    facilityId: number;
    month: string;
    count: number;
}
export async function getDataEntryCountByMonthAndFacility(
    orgInternalName: string,
    month: string
): Promise<DataEntryCountByMonthAndFacility[]> {
    let momentMonth = moment(month, 'YYYY-MM');
    if (!momentMonth.isValid()) {
        throw new Error('Invalid argument, month not in correct format YYYY-MM');
    }

    var searchParameters: Elasticsearch.SearchParams = {
        index: 'import_events_v1',
        body: {
            size: 0,
            aggs: {
                byFacility: {
                    terms: {
                        field: 'facilityId',
                        size: 1000
                    }
                }
            },
            query: {
                bool: {
                    must: [
                        {
                            match: {
                                orgInternalName: {
                                    query: orgInternalName,
                                    type: 'phrase'
                                }
                            }
                        },
                        {
                            match: {
                                eventType: {
                                    query: 'record_status_update',
                                    type: 'phrase'
                                }
                            }
                        },
                        {
                            match: {
                                'eventData.statusFrom': {
                                    query: 'pending_data_entry',
                                    type: 'phrase'
                                }
                            }
                        },
                        {
                            match: {
                                'eventData.statusTo': {
                                    query: 'pending_processing',
                                    type: 'phrase'
                                }
                            }
                        },
                        {
                            range: {
                                eventTime: {
                                    gte: momentMonth.startOf('month').format('YYYY-MM-DD'),
                                    lte: momentMonth.endOf('month').format('YYYY-MM-DD'),
                                    time_zone: 'America/Chicago'
                                }
                            }
                        }
                    ]
                }
            }
        }
    };

    let esResults = await es.createCollectorClient().search(searchParameters);
    let facilityResults: DataEntryCountByMonthAndFacility[] = [];
    for (let facilityCountBucket of esResults.aggregations.byFacility.buckets) {
        facilityResults.push({
            facilityId: facilityCountBucket.key,
            count: facilityCountBucket.doc_count,
            month: month
        });
    }
    return facilityResults;
}

function validateMonth(month: string): boolean {
    return /^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])$/.test(month);
}

export interface GetSystemUsageByOrgResults {
    orgInternalName: string,
    facilityId: number,
    facilityActiveIndicator: boolean,
    casesCreated: number,
    casesPerformed: number,
    dataEntryPerformed: number,
    recordsImported: number
}
export async function getSystemUsageByOrg(orgInternalName: string, month: string, excludeInactiveFacilities:boolean = true):Promise<GetSystemUsageByOrgResults[]> {
    if (!validateMonth(month)) {
        throw new Error('Invalid month argument, must be in format YYYY-MM.');
    }

    let results:GetSystemUsageByOrgResults[] = [];

    let startDate = moment(month, 'YYYY-MM')
        .startOf('month')
        .format('YYYY-MM-DD');
    let endDate = moment(month, 'YYYY-MM')
        .endOf('month')
        .format('YYYY-MM-DD');

    //console.log('Get facilities...');
    let facilities: Facility[] = await FacilityDAO.getFacilities(orgInternalName);

    //console.log('Get getCaseCountByFacilityAndMonth...');
    let orgCasesCreatedResults = await ImportAnalyticsDAO.getCaseCountByFacilityAndMonth(
        orgInternalName
    );

    //console.log('Get getCaseCountWithDOSByFacilityAndMonth...');
    let orgCasesPerformedResults = await ImportAnalyticsDAO.getCaseCountWithDOSByFacilityAndMonth(
        orgInternalName
    );
    
    //console.log('Get getDataEntryCounts...');
    let dataEntryAnalytics = await DataEntryAnalyticsDAO.getDataEntryCounts(
        orgInternalName,
        startDate,
        endDate
    );

    for (let facility of facilities) {
        let facilityCasesCreated = (
            orgCasesCreatedResults.find((r) => r.facilityId == facility.facilityId) || {
                counts: []
            }
        ).counts.find((r) => r.month == month) || { count: 0 };

        let facilityCasesPerformed = (
            orgCasesPerformedResults.find((r) => r.facilityId == facility.facilityId) || {
                counts: []
            }
        ).counts.find((r) => r.month == month) || { count: 0 };

        let facilityDataEntryPerformed = (
            dataEntryAnalytics.byFacility.find((r) => r.key == facility.facilityId) || {
                doc_count: 0
            }
        ).doc_count;

        //console.log('Get getImportRecordUsageForFacility...');
        let facilityImportRecordUsage = await DataEntryAnalyticsDAO.getImportRecordUsageForFacility(
            orgInternalName,
            facility.facilityId,
            startDate,
            endDate
        );

        let totalImportRecordCount =
            facilityImportRecordUsage.missingTemplateCount +
            facilityImportRecordUsage.byTemplateCount.reduce(
                (totalCount: number, templateCount) => {
                    return totalCount + templateCount.count;
                },
                0
            );

        if (facility.testFacilityIndicator) {
            continue;
        }

        if(excludeInactiveFacilities === true && facility.activeIndicator == false) {
            continue;
        }

        results.push({
            orgInternalName: orgInternalName,
            facilityActiveIndicator: facility.activeIndicator,
            facilityId: facility.facilityId,
            casesCreated: facilityCasesCreated.count,
            casesPerformed: facilityCasesPerformed.count,
            dataEntryPerformed: facilityDataEntryPerformed,
            recordsImported: totalImportRecordCount,
        });
    }

    return results;
}

interface GetActiveUsersResult {
    orgInternalName: string;
    organizationName: string;
    userName: string;
    userRoles: string[];
    activeDays: number;
}
export async function getUsersWithActivity(startDate:string, endDate:string, orgInternalName:string, facilityId?:number):Promise<GetActiveUsersResult[]> {
    if (!orgInternalName) {
        throw new Error('Missing parameter orgInternalName.');
    }

    if(!startDate || !endDate) {
        throw new Error('Missing start date or end date parameters.');
    }

    let query = `
        WITH activity AS (
            SELECT al.aud_usr_id,
                COUNT(DISTINCT CAST(al.aud_evnt_dttm AS DATE)) AS active_days
            FROM aud_log al
            WHERE CAST(al.aud_evnt_dttm AT TIME ZONE 'US/Central' AS DATE) BETWEEN :startDate AND :endDate
            ${_.isNumber(facilityId) ? 'AND al.fac_id = :facilityId' : ''}
            GROUP BY 1
        ),
        users AS (
            SELECT usr_nm,
                ARRAY_TO_STRING(ARRAY_AGG(role_nm),'; ') AS usr_role,
                active_days
            FROM activity a
            JOIN usr u
                ON u.usr_id = a.aud_usr_id
            JOIN usr_role ur
                ON ur.usr_id = u.usr_id
            JOIN org_role r
                ON r.role_id = ur.role_id
            WHERE u.usr_nm NOT IN ('AlicePryfogle','alligcarpenter','aernst','gabrielleoldham','kellydansby',
                                    'leslielutes','lcarlson','mistydansby','rhondac','sspensley','sefriend')
              AND LOWER(u.email_addr) NOT LIKE '%graphiumhealth%'
              AND LOWER(u.email_addr) NOT LIKE '%fieldmed%'
            GROUP BY 1,3
        )
        SELECT o.org_id AS "orgInternalName",
                o.org_nm AS "organizationName",
                u.usr_nm AS "userName",
                u.usr_role AS "userRoles",
                u.active_days AS "activeDays"
        FROM org o
        CROSS JOIN users u
        ORDER BY 2,3,4,5;
    `;
    
    let queryOptions = { 
         type: Sequelize.QueryTypes.SELECT,
         replacements: {
             startDate: startDate,
             endDate: endDate,
             facilityId: undefined
         }
    }

    if(_.isNumber(facilityId)) {
        queryOptions.replacements.facilityId = facilityId;
    }

    let activeUsers = await OrgModels.queryReadOnly(orgInternalName, query, queryOptions);
    let returnData = activeUsers.map((au) => {
        if(au.userRoles) { au.userRoles = au.userRoles.split(';').map(_.trim) }
        au.activeDays = _.parseInt(au.activeDays);
        return au;
    });

    return returnData;
}

/*
export async function getAnesthesiaCasesCreatedByMonthAndFacility(orgInternalName:string) {
    var query = `SELECT f.fac_id,
         f.fac_nm,
         CAST(EXTRACT(YEAR FROM efs.proc_dt) AS SMALLINT) AS case_year,
         CAST(EXTRACT(MONTH FROM efs.proc_dt) AS SMALLINT) AS case_month,
         COUNT(*)
    FROM fac f
    JOIN enctr e
      ON e.fac_id = f.fac_id
    JOIN enctr_form ef
      ON ef.enctr_id = e.enctr_id
     AND ef.void_ind = FALSE
    JOIN enctr_form_surgery efs
      ON efs.enctr_form_id = ef.enctr_form_id
   GROUP BY 1,2,3,4
   ORDER BY 1,2,3,4`;
  
     var queryOptions = {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
      }
    };
  
      if (!orgInternalName)
          throw new Error('Missing parameter orgInternalName.');
    
    var formattedResults = [];
      return OrgModels.query(orgInternalName, query, queryOptions)
    .then(function(results) {
      for(let result of results) {
        var existingFacilityCounts = formattedResults.find((fr) => fr.facilityId == result.fac_id);
        if(!existingFacilityCounts) {
          existingFacilityCounts = { facilityId: result.fac_id, counts:[] };
          formattedResults.push(existingFacilityCounts);
        }
  
        if(result.case_year == null || result.case_month == null)
          return;
  
        var monthYear = result.case_year.toString() + '-' + _.padStart(result.case_month.toString(),2,'0');
        existingFacilityCounts.counts.push({
          month: monthYear,
          count: parseInt(result.count)
        });
      })
      return Promise.resolve(formattedResults);
    })
  }
  */
