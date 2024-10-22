
import { Router, Request, Response, NextFunction } from 'express';
import * as moment from 'moment';
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
import * as Elasticsearch from "elasticsearch";
import * as es from "@common/lib/util/esUtil";

import * as auth from '../util/authMiddleware';
import * as DateUtil from '@common/lib/util/DateUtil';
import * as PqrsAnalyticsDAO from '@common/lib/dao/PQRSAnalyticsDAO';
import * as ImportAnalyticsDAO from '@common/lib/dao/ImportAnalyticsDAO';
import * as DataEntryAnalyticsDAO from '@common/lib/dao/analytics/DataEntryAnalyticsDAO';
import * as FacilitySettingDAO from '@common/lib/dao/FacilitySettingDAO';
import * as ScoreCardMetricsDAO from '@common/lib/dao/ScoreCardMetricsDAO';
import * as StaticOrgScoreCardMetricsDAO from '@common/lib/dao/StaticOrgScoreCardMetricsDAO';
import * as FacilityDAO from '@common/lib/dao/org/FacilityDAO';
import * as ProviderDAO from '@common/lib/dao/org/ProviderDAO';
import * as EncounterFormService from '@common/lib/dao/EncounterFormService';

import * as DataErrorUtils from '../util/dataErrorUtils';
import validateNpi from '@common/lib/util/NpiValidator';


import Facility from '@common/lib/model/flow/Facility';
import Provider from '@common/lib/model/flow/Provider';
import CalculatedScoreCardMetric from '@common/lib/model/flow/CalculatedScoreCardMetric';
import StaticOrgScoreCardMetricSample from '@common/lib/model/flow/StaticOrgScoreCardMetricSample';
import ScoreCardMetricSample from '@common/lib/model/flow/ScoreCardMetricSample';
import { ProvidedData } from '@common/lib/dao/ScoreCardMetricsDAO';
import { ScoreCardFacilitySetting } from '@common/lib/model/flow/ScoreCardFacilitySetting';
import { Macra2017CaseData, AbgMeasureCalculatedMean2017 } from '@common/lib/model/macra/Macra2017CaseData';
import { DataEntryErrorResult } from '@common/lib/model/DataEntryErrorModels';
import { Macra2019CaseData, AbgMeasureCalculatedMean2019 } from '@common/lib/model/macra/Macra2019Models';

import * as util from 'util';
import { PqrsProvider, PqrsProvider2019 } from '@common/lib/model/PQRSProvider';

export class DashboardServices {
    router:Router;

    constructor() {
        this.router = Router();
        this.router.get('/facilities.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getFacilities);
        this.router.get('/providers.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getProviders);
        this.router.get( '/usage.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getUsageAnalytics);
        this.router.get( '/importBatch.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}), this.getImportBatchAnalytics);
        this.router.get( '/usage/importRecords.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}), this.getImportRecordsAnalytics);
        this.router.get( '/dataEntry.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}), this.getDataEntryAnalytics);
        this.router.get( '/macra2017.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getMacra2017Data);
        this.router.get( '/macra2017/org.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getMacra2017DataForOrg);
        this.router.get( '/macra2017/tin/:tin.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getMacra2017DataByTIN);
        this.router.post('/macra2017/settings/facilitySettings.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.saveQcdrFacilitySettings);
        this.router.get( '/macra2017/settings/facilitySettings.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.getQcdrFacilitySettings);
        this.router.get( '/macra2017/settings/general.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.getQcdrGeneralSettings);
        this.router.post('/macra2017/settings/providers.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.saveQcdrProviderSettings);
        this.router.get( '/macra2017/settings/providers.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.getQcdrProviderSettings);
        this.router.get( '/macra2017/settings.json', auth.ensureAuthenticatedOrg({roles: {some:['ORG_ADMIN']}}), this.getQcdrSettings);
        this.router.get( '/macra2019.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getMacra2019Data);
        this.router.get( '/macra2019/tin/:tin.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getMacra2019DataByTIN);
        this.router.get( '/pqrs.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN', 'FAC_ADMIN']}}), this.getPQRSAnalytics);
        this.router.get( '/dataEntry/errors/org/count.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getDataEntryErrorCountForOrg );
        this.router.get( '/dataEntry/errors/records.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getDataEntryErrorRecords );
        this.router.get( '/dataEntry/errors/facility/:facilityId/provider/:providerId/count.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getDataEntryErrorCountsForProvider );
        this.router.get( '/dataEntry/errors/facility/:facilityId/count.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getDataEntryErrorCountsForFacility );
        this.router.get( '/dataAnomalies.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getDataAnomalies );
        
    }

    public getFacilities = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving Facilities for org.')
        const org = req.session.org;
        let facilities = await FacilityDAO.getFacilities(org);
        res.status(200).send(_.sortBy(facilities, ['facilityName']));
    }

    public getProviders = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving Providers for org.');
        let providers = await ProviderDAO.getProviders(req.session.org);
        res.status(200).send(_.sortBy(providers, ['lastName']));
    }

    public getUsageAnalytics = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving usage analytics.');
        try {
            Promise.all([
                ImportAnalyticsDAO.getImportBatchRecordsByFacilityAndMonth(req.session.org),
                ImportAnalyticsDAO.getUnassignedImportRecordCountsByMonth(req.session.org),
                ImportAnalyticsDAO.getCaseCountByFacilityAndMonth(req.session.org),
                ImportAnalyticsDAO.getCaseCountWithDOSByFacilityAndMonth(req.session.org),
                DataEntryAnalyticsDAO.getDataEntryCountsByMonth(req.session.org)
            ])
            .then(([importBatchCounts, unassignedImportRecordCounts, caseCounts, caseCountsWithDos, dataEntryByFacilityAndMonth]) => {
                console.log('Analytics retrieved.');
                res.status(200).send({
                    importBatchCounts: importBatchCounts,
                    unassignedImportRecordCounts: unassignedImportRecordCounts,
                    caseCounts: caseCounts,
                    caseCountsWithDos: caseCountsWithDos,
                    dataEntryByFacilityAndMonth: dataEntryByFacilityAndMonth
                });
            })
            .catch(function(error) {
                console.error('ERROR: ' + error.message);
                console.error(error.stack);
                res.status(500).send(error.message);
            })
        }
        catch(error) {
            console.log('error: ' + error.message);
            res.status(500).send(error.message);
        }
    }

    public getImportBatchAnalytics = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving import batch analytics.');
        
        if(!req.query.startDate || !req.query.endDate) {
            res.status(500).send('Missing required parameter, startDate, endDate or facilityId.');
        }
    
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
    
        Promise.all([
            ImportAnalyticsDAO.getDailyNewImportBatchRecordCounts(req.session.org, startDate, endDate),
            ImportAnalyticsDAO.getDailyDataEntryCounts(req.session.org, startDate, endDate),
            ImportAnalyticsDAO.getCurrentBatchStatusCounts(req.session.org),
            ImportAnalyticsDAO.getCurrentRecordStatusCounts(req.session.org),
            ImportAnalyticsDAO.getRecordStatusCountsByFacility(req.session.org)
        ])
        .then(([dailyRecordCreatedCounts, dailyDataEntryCounts, batchStatusCounts, recordStatusCounts, recordStatusCountsByFacility]) => {
            console.log('Analytics retrieved.');
            res.status(200).send({
                dailyDataEntryCounts: dailyDataEntryCounts,
                dailyRecordCreatedCounts: dailyRecordCreatedCounts,
                batchStatusCounts: batchStatusCounts,
                recordStatusCounts: recordStatusCounts,
                recordStatusCountsByFacility: recordStatusCountsByFacility
            });
        })
        .catch(function(error) {
            console.error('ERROR: ' + error.message);
            console.error(error.stack);
            res.status(500).send(error.message);
        })
    }

    public getImportRecordsAnalytics = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving data entry analytics.');

        if(req.query.facilityId == null) {
            res.status(500).send('Missing required parameter facilityId.');
        }

        if(!req.query.startDate || !req.query.endDate) {
            res.status(500).send('Missing required parameter(s) startDate or endDate.');
        }

        console.log('Running query for: ' + JSON.stringify({facilityId:req.query.facilityId, startDate:req.query.startDate , endDate:req.query.endDate }))
        Bluebird.all([
            DataEntryAnalyticsDAO.getImportRecordUsageForFacility(req.session.org, req.query.facilityId, req.query.startDate, req.query.endDate)
        ])
        .then(([importRecordUsage]) => {
            res.status(200).send({
                importRecordUsage: importRecordUsage
            });
        })
        .catch(function(error) {
            console.error('ERROR: ' + error.message);
            console.error(error.stack);
            res.status(500).send(error.message);
        })
    }

    public getDataEntryAnalytics = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving data entry analytics.');
        
        if(!req.query.startDate || !req.query.endDate) {
            res.status(500).send('Missing required parameter, startDate, endDate.');
        }
    
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
    
        Promise.all([
            DataEntryAnalyticsDAO.getDataEntryCounts(req.session.org, startDate, endDate)
        ])
        .then(([dataEntryCounts]) => {
            res.status(200).send({
                dataEntryCounts: dataEntryCounts
            });
        })
        .catch(function(error) {
            console.error('ERROR: ' + error.message);
            console.error(error.stack);
            res.status(500).send(error.message);
        })
    }

    public getMacra2017Data = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving macra data...');
        try {
            let org  = req.session.org;
            let startDate = req.query.startDate as string;
            let endDate = req.query.endDate as string;
            let facilityId = parseInt(req.query.facilityId as string);
            let enforceRollup = req.query.enforceRollup || false;
            let rollupFacilityIds = [];

            if (enforceRollup) {
                let facilitySettings:ScoreCardFacilitySetting[] = await ScoreCardMetricsDAO.getScoreCardFacilitySettings(org);
                rollupFacilityIds = facilitySettings.filter((setting) => setting.rollupToFacility == facilityId).map((setting) => setting.facilityId);
            }

            PqrsAnalyticsDAO.getMacra2017Results(req.session.org, [facilityId, ...rollupFacilityIds], startDate, endDate)
            .then(function(results) {
                res.status(200).send(results);
            })
            .catch(function(error) {
                console.log(error.stack);
                res.status(500).send('Unable to 2017 MACRA results: ' + error.message);
            });
        }
        catch(error) {
            console.log(error.stack);
            res.status(500).send('Unable to retreive MACRA data: ' + error.message);
        }
    }

    public getMacra2017DataForOrg = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving macra data for org...');
        try {
            let org  = req.session.org;
            let startDate = req.query.startDate as string;
            let endDate = req.query.endDate as string;
            let facilities = await FacilityDAO.getFacilities(org);
            let facilityIds:number[] = facilities.map((facility:Facility) => { return facility.facilityId });

            PqrsAnalyticsDAO.getMacra2017Results(req.session.org, facilityIds, startDate, endDate)
            .then(function(results) {
                res.status(200).send(results);
            })
            .catch(function(error) {
                console.log(error.stack);
                res.status(500).send('Unable to retrieve 2017 MACRA results for org: ' + error.message);
            });
        }
        catch(error) {
            console.log(error.stack);
            res.status(500).send('Unable to retreive MACRA data for org: ' + error.message);
        }
    }

    public getMacra2017DataByTIN = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving MACRA data for TIN: ' + req.params.tin + '...');
        
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const tin = parseInt(req.params.tin);
        
        PqrsAnalyticsDAO.getQcdrGeneralSettings(req.session.org)
            .then(function(result) {
                let facIds = _.keys(result.tinSettings);
                let matchingFacIds = [];

                for (let facId of facIds) {
                    let setting = result.tinSettings[facId];

                    if (setting.applyTinToAll && setting.groupTin === tin)
                        matchingFacIds.push(facId);
                }
                console.log(matchingFacIds);
                return matchingFacIds;
            })
            .then((facilityIds) => {
                return Bluebird.all([
                    PqrsAnalyticsDAO.getMacra2017Results(req.session.org, facilityIds, startDate, endDate),
                    ScoreCardMetricsDAO.calculateMetricsForOrg(req.session.org, facilityIds, null, startDate, endDate, false, true),
                    ScoreCardMetricsDAO.getFacilityComplicationsForDateRange(req.session.org, facilityIds, startDate, endDate)
                ]);
            })
            .then(function(results) {
                res.status(200).send({
                    macraData: results[0],
                    calculatedMetrics: results[1],
                    complications: results[2]
                });
            })
            .catch(function(error) {
                console.log(error.stack);
                res.status(500).send('Unable to 2017 MACRA results: ' + error.message);
            });
    }

    public saveQcdrFacilitySettings = (req:Request, res:Response, next:NextFunction) => {
        PqrsAnalyticsDAO.updateQcdrFacilitySettings(req.session.org, req.body)
            .then(function(result) {
                res.status(200).send();
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getQcdrFacilitySettings = (req:Request, res:Response, next:NextFunction) => {
        PqrsAnalyticsDAO.getQcdrFacilitySettings(req.session.org)
            .then(function(result) {
                res.status(200).send(result);
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getQcdrGeneralSettings = (req:Request, res:Response, next:NextFunction) => {
        PqrsAnalyticsDAO.getQcdrGeneralSettings(req.session.org)
            .then(function(result) {
                res.status(200).send({});
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public saveQcdrProviderSettings = (req:Request, res:Response, next:NextFunction) => {
        PqrsAnalyticsDAO.updateQcdrProviderSettings(req.session.org, req.body)
            .then(function(result) {
                res.status(200).send();
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getQcdrProviderSettings = (req:Request, res:Response, next:NextFunction) => {
        PqrsAnalyticsDAO.getQcdrProviderSettings(req.session.org)
            .then(function(result) {
                res.status(200).send(result);
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getQcdrSettings = (req:Request, res:Response, next:NextFunction) => {
        Promise.all([
            PqrsAnalyticsDAO.getQcdrGeneralSettings(req.session.org),
            PqrsAnalyticsDAO.get2018Providers(req.session.org),
        ])
        .then(([generalSettings, providers]) => {
            let validatedProviders:PqrsProvider[] = (providers as PqrsProvider[]).filter((provider:PqrsProvider) => {
                return validateNpi(provider.providerNpi);
            });
            
            res.status(200).send({
                generalSettings: generalSettings,
                providers: validatedProviders
            })
        })
        .catch(function(error) {
            res.status(500).send(error.message);
        })
    }

    public getMacra2019Data = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving macra 2019 data...');
        try {
            let org  = req.session.org;
            let startDate = req.query.startDate as string;
            let endDate = req.query.endDate as string;
            let facilityId = parseInt(req.query.facilityId as string);
            let enforceRollup = req.query.enforceRollup || false;
            let rollupFacilityIds = [];

            if (enforceRollup) {
                let facilitySettings:ScoreCardFacilitySetting[] = await ScoreCardMetricsDAO.getScoreCardFacilitySettings(org);
                rollupFacilityIds = facilitySettings.filter((setting) => setting.rollupToFacility == facilityId).map((setting) => setting.facilityId);
            }

            PqrsAnalyticsDAO.getMacra2019Results(req.session.org, [facilityId, ...rollupFacilityIds], startDate, endDate)
            .then(function(results) {
                res.status(200).send(results);
            })
            .catch(function(error) {
                console.log(error.stack);
                res.status(500).send('Unable to retrieve MACRA 2019 results: ' + error.message);
            });
        }
        catch(error) {
            console.log(error.stack);
            res.status(500).send('Unable to retreive MACRA 2019 data: ' + error.message);
        }
    }

    public getMacra2019DataByTIN = (req:Request, res:Response, next:NextFunction) => {
        console.log('Retrieving MACRA 2019 data for TIN: ' + req.params.tin + '...');
        
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const tin = parseInt(req.params.tin);
        
        PqrsAnalyticsDAO.getQcdrGeneralSettings(req.session.org)
            .then(function(result) {
                let facIds = _.keys(result.tinSettings);
                let matchingFacIds = [];

                for (let facId of facIds) {
                    let setting = result.tinSettings[facId];

                    if (setting.applyTinToAll && setting.groupTin === tin)
                        matchingFacIds.push(facId);
                }
                //console.log(matchingFacIds);
                return matchingFacIds;
            })
            .then((facilityIds) => {
                return Bluebird.all([
                    PqrsAnalyticsDAO.getMacra2019Results(req.session.org, facilityIds, startDate, endDate),
                    ScoreCardMetricsDAO.calculateMetricsForOrg(req.session.org, facilityIds, null, startDate, endDate, false, true),
                    ScoreCardMetricsDAO.getFacilityComplicationsForDateRange(req.session.org, facilityIds, startDate, endDate)
                ]);
            })
            .then(function(results) {
                res.status(200).send({
                    macraData: results[0],
                    calculatedMetrics: results[1],
                    complications: results[2]
                });
            })
            .catch(function(error) {
                console.log(error.stack);
                res.status(500).send('Unable to 2017 MACRA results: ' + error.message);
            });
    }

    public getPQRSAnalytics = (req:Request, res:Response, next:NextFunction) => {
        console.log('Requesting analytics data.');
        
        var startDate = req.query.startDate;
        var endDate = req.query.endDate as string;
        var facilityId = parseInt(req.query.facilityId as string);
    
        PqrsAnalyticsDAO.getFacilityOverviewByDateRange(req.session.org, facilityId, startDate, endDate)
        .then(function(results) {
    
            var compliantCount = 0;
            var totalCount = 0;
            var allMissingFields = [];
            var formMissingFieldCount = 0;
            var meetDomainCount = 0;
            var meetMeasureCount = 0;
            var notMissingDataCount = 0;
            var surgeonComplianceResults = {};
            var anesComplianceResults = {};
    
            for(var i = 0; i < results.length; i++) {
                var result = results[i];
                result.qcdr_eval_result = JSON.parse(result.qcdr_eval_result);
                result.import_result = JSON.parse(result.import_result);
    
                var isCompliant = result.qcdr_domain_count >= 3 && result.qcdr_measure_count >= 9 && result.qcdr_missing_data_count == 0;
                compliantCount += Number(isCompliant);
                allMissingFields = _.concat(allMissingFields, result.qcdr_eval_result ? result.qcdr_eval_result.missingDataList : []);
                meetDomainCount += Number(result.qcdr_domain_count >= 3);
                meetMeasureCount += Number(result.qcdr_measure_count >= 9);
                notMissingDataCount += Number(result.qcdr_missing_data_count == 0);
    
                if(result.surgn_prvr) {
                    var surgeonParts = result.surgn_prvr.split('|');
                    var surgeonProviderId = surgeonParts[0];
                    var surgeonProviderName = surgeonParts[1];
                    var surgeonComplianceTotals = surgeonComplianceResults[surgeonProviderName];
                    if(!surgeonComplianceTotals) {
                        surgeonComplianceTotals = {
                            providerId: surgeonProviderId,
                            providerName: surgeonProviderName,
                            totalCases: 0,
                            compliantCases: 0,
                        }
                        surgeonComplianceResults[surgeonProviderName] = surgeonComplianceTotals;
                    }
                    surgeonComplianceTotals.totalCases++;
                    surgeonComplianceTotals.compliantCases += isCompliant;
                    surgeonComplianceTotals.complianceRate = 
                        surgeonComplianceTotals.totalCases > 0 ? surgeonComplianceTotals.compliantCases/surgeonComplianceTotals.totalCases : 0;
                }
    
                if(result.anes_prvrs) {
                    var anesProviders = result.anes_prvrs.split(',');
    
                    for(var p = 0; p < anesProviders.length; p++) {
                        var anesParts = anesProviders[p].split('|');
                        var anesProviderId = anesParts[0];
                        var anesProviderType = anesParts[1];
                        var anesProviderName = anesParts[2];
                        var anesComplianceTotals = anesComplianceResults[anesProviderName];
                        if(!anesComplianceTotals) {
                            anesComplianceTotals = {
                                providerId: anesProviderId,
                                providerType: anesProviderType,
                                providerName: anesProviderName,
                                totalCases: 0,
                                compliantCases: 0,
                            }
                            anesComplianceResults[anesProviderName] = anesComplianceTotals;
                        }
                        anesComplianceTotals.totalCases++;
                        anesComplianceTotals.compliantCases += isCompliant;
                        anesComplianceTotals.complianceRate = 
                            anesComplianceTotals.totalCases > 0 ? anesComplianceTotals.compliantCases/anesComplianceTotals.totalCases : 0;
                    }
                }
            }
    
            // Create a missing fields list that includes 0 counts for
            var requiredFields = [
                'Date of Service',
                'Surgeon Provider',
                'Anesthesia Provider',
                'Anesthesia Start Date',
                'Anesthesia Start Time',
                'Anesthesia End Date',
                'Anesthesia End Time',
                'Primary Anesthetic',
                'ASA Physical Status',
                'Patient DOB'
            ]; 
    
            var allMissingFieldsGroups = _.groupBy(allMissingFields);
            var missingRequiredFieldsCounts = _.map(requiredFields, function(fieldName) {
                return {
                    fieldName: fieldName,
                    count: allMissingFieldsGroups[fieldName] ? allMissingFieldsGroups[fieldName].length : 0
                } 
            })
    
    
            var analyticsData = {
                totalCount: results.length,
                compliantCount: compliantCount,
                allMissingFields: allMissingFields,
                missingRequiredFieldsCounts: missingRequiredFieldsCounts,
                meetDomainCount: meetDomainCount,
                meetMeasureCount: meetMeasureCount,
                notMissingDataCount: notMissingDataCount,
                surgeonComplianceResults: _.values(surgeonComplianceResults),
                anesComplianceResults: _.values(anesComplianceResults),
                forms: results
            };
    
            res.status(200).send(analyticsData);
        })
        .catch(function(error) {
            //console.error(error.message);
            //console.error(error.stack);
            res.status(500).send('Unable to retrieve analytics: ' + error.message);
        })
    }

    public getFacilityGoals = (req:Request, res:Response, next:NextFunction) => {
        console.log('Requesting facility goals.');
        var facilityId = parseInt(req.query.facilityId as string);
        FacilitySettingDAO.getSetting(req.session.org, facilityId, 'facilityGoals')
            .then(function(results) {
                res.status(200).send(results);
            })
            .catch(function(error){
                res.status(500).send('Unable to retrieve facility goals: ' + error.message);
            });
    }

    public saveFacilityGoals = (req:Request, res:Response, next:NextFunction) => {
        console.log('Requesting facility goals.');
        var facilityId = parseInt(req.query.facilityId as string);
        var goalData = req.body.goals;
        
        FacilitySettingDAO.putSetting(req.session.org, facilityId, 'facilityGoals', goalData)
            .then(function(results) {
                res.status(200).send(results);
            })
            .catch(function(error){
                res.status(500).send('Unable to save facility goals: ' + error.message);
            });
    }

    public saveScoreCardFacilitySettings = (req:Request, res:Response, next:NextFunction) => {
        ScoreCardMetricsDAO.updateScoreCardFacilitySettings(req.session.org, req.body)
            .then(function(result) {
                res.status(200).send();
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getScoreCardFacilitySettings = (req:Request, res:Response, next:NextFunction) => {
        ScoreCardMetricsDAO.getScoreCardFacilitySettings(req.session.org)
            .then(function(result) {
                res.status(200).send(result);
            })
            .catch(function(error) {
                res.status(500).send(error.message);
            });
    }

    public getDataEntryErrorCountForOrg = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Getting Data Entry Errors for Org');
        const org = req.session.org;
        const startDate = req.query.startDate;

        let searchParams:Elasticsearch.SearchParams = {
            index: 'import_events_v1',
            body: {
                size: 0,
                aggs: {
                    byErrorType: {
                        nested: {
                            path: "initialDataEntryErrorFields"
                        },
                        aggs: {
                            errorTypes: {
                                terms: {
                                    field: "initialDataEntryErrorFields.error"
                                },
                                aggs: {
                                    fields: {
                                        terms: {
                                            field: "initialDataEntryErrorFields.fieldName"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    byFacility: {
                        terms: {
                            field: 'facilityId'
                        },
                        aggs: {
                            errors: {
                                nested: {
                                    path: 'initialDataEntryErrorFields'
                                }
                            }
                        }
                    }
                },
                query: {
                    bool: {
                        filter: [
                            { range: { 'createdAt': {
                                gte: startDate,
                                lte: startDate+'||/M',
                                time_zone: '-06:00'
                            }}},
                            { range: { 'initialDataEntryErrorCount': {
                                gt: 0,
                            }}},
                            { term: { "_type": "import_batch_record" }},
                            { term: { "orgInternalName": org }},
                        ]
                    }
                }
            }
        }

        let results = await es.createCollectorClient().search(searchParams);
        let facilities: Facility[] = await FacilityDAO.getFacilities(req.session.org);
        let facilityMap = new Map();
        let byErrorResults:DataEntryErrorResult[] = [];
        let byFacilityResults:DataEntryErrorResult[] = [];
        
        for ( let facility of facilities ) {
            facilityMap.set(facility.facilityId, facility.facilityName);
        }

        for (let errorTypeBucket of results.aggregations.byErrorType.errorTypes.buckets) {
            for (let fieldBucket of errorTypeBucket.fields.buckets) {
                byErrorResults.push({
                    fieldKey: fieldBucket.key,
                    errorTypeKey: errorTypeBucket.key,
                    label: DataErrorUtils.getErrorLabel(errorTypeBucket.key, fieldBucket.key),
                    value: fieldBucket.doc_count,
                });
            }
        }

        for (let facilityErrorBucket of results.aggregations.byFacility.buckets) {
            if (facilityErrorBucket.errors.doc_count === 0)
                continue;

            byFacilityResults.push({
                facilityId: facilityErrorBucket.key,
                label: facilityMap.get(parseInt(facilityErrorBucket.key)),
                value: facilityErrorBucket.errors.doc_count,
            });
        }

        byErrorResults = _.orderBy(byErrorResults, ['value'], ['desc']);
        byFacilityResults = _.orderBy(byFacilityResults, ['value'], ['desc']);
        
        res.status(200).send({
            byError: byErrorResults,
            byFacility: byFacilityResults,
        });
    }
    
    public getDataEntryErrorRecords = async (req: Request, res: Response, next: NextFunction) => {
        console.log('Getting Data Entry Error Records');
        const org = req.session.org;
        const startDate = req.query.startDate;
        const size = req.query.size;
        const facilityId = req.query.facilityId || null;
        const providerId = req.query.providerId || null;
        const errorTypeKey = req.query.errorTypeKey as string || null;
        const fieldKey = req.query.fieldKey || null;

        let searchParams:Elasticsearch.SearchParams = {
            index: 'import_events_v1',
            body: {
                //size: size,
                size: 10000,
                query: {
                    bool: {
                        filter: [
                            { range: { 'createdAt': {
                                gte: startDate,
                                lte: startDate+'||/M',
                                time_zone: '-06:00'
                            }}},
                            { range: { 'initialDataEntryErrorCount': {
                                gt: 0,
                            }}},
                            { term: { "_type": "import_batch_record" }},
                            { term: { "orgInternalName": org }},
                        ]
                    }
                }
            }
        }

        const filter:Array<object> = searchParams.body.query.bool.filter;

        if (facilityId) {
            filter.push({ term: { "facilityId": facilityId }});
        }

        if (providerId) {
            filter.push({ term: { "primaryResponsibleProviderId": providerId }});
        } 

        if (fieldKey) {
            filter.push({ 
                nested: {
                    path: 'dataEntryErrorFields',
                    query: { match: {"dataEntryErrorFields.fieldName": fieldKey}}
                }
            });
        }
        
        if (errorTypeKey) {
            filter.push({ 
                nested: {
                    path: 'dataEntryErrorFields',
                    query: { match: {"dataEntryErrorFields.error": decodeURIComponent(errorTypeKey)}}
                }
            });
        }

        //console.log(util.inspect(searchParams, false, null));

        let results:Elasticsearch.SearchResponse<{}> = await es.createCollectorClient().search(searchParams);
        res.status(200).send(results.hits.hits);
    }

    public getDataEntryErrorCountsForFacility = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Getting Data Entry Errors for Facility');
        const org = req.session.org;
        const startDate = req.query.startDate;
        const facilityId = req.params.facilityId;

        let searchParams:Elasticsearch.SearchParams = {
            index: 'import_events_v1',
            body: {
                size: 0,
                aggs: {
                    byErrorType: {
                        nested: {
                            path: "initialDataEntryErrorFields"
                        },
                        aggs: {
                            errorTypes: {
                                terms: {
                                    field: "initialDataEntryErrorFields.error"
                                },
                                aggs: {
                                    fields: {
                                        terms: {
                                            field: "initialDataEntryErrorFields.fieldName"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    byProvider: {
                        terms: {
                            field: 'primaryResponsibleProviderId'
                        },
                        aggs: {
                            errors: {
                                nested: {
                                    path: 'initialDataEntryErrorFields'
                                }
                            }
                        }
                    }
                },
                query: {
                    bool: {
                        filter: [
                            { range: { 'createdAt': {
                                gte: startDate,
                                lte: startDate+'||/M',
                                time_zone: '-06:00'
                            }}},
                            { term: { "_type": "import_batch_record" }},
                            { term: { "orgInternalName": org }},
                            { term: { "facilityId": facilityId }},
                        ]
                    }
                }
            }
        }

        let results = await es.createCollectorClient().search(searchParams);
        let providers: Provider[] = await ProviderDAO.getProvidersByFacility(org, facilityId);
        let providerMap = new Map();
        let byErrorResults: DataEntryErrorResult[] = [];
        let byProviderResults: DataEntryErrorResult[] = [];

        for ( let provider of providers ) {
            const name = `${provider.lastName}, ${provider.firstName}`;
            providerMap.set(parseInt(provider.providerId), name);
        }
        
        for (let errorTypeBucket of results.aggregations.byErrorType.errorTypes.buckets) {
            for (let fieldBucket of errorTypeBucket.fields.buckets) {
                byErrorResults.push(<DataEntryErrorResult>{
                    errorTypeKey: errorTypeBucket.key,
                    fieldKey: fieldBucket.key,
                    label: DataErrorUtils.getErrorLabel(errorTypeBucket.key, fieldBucket.key),
                    value: fieldBucket.doc_count,
                    facilityId: parseInt(facilityId),
                });
            }
        }

        for (let providerErrorBucket of results.aggregations.byProvider.buckets) {
            if (providerErrorBucket.errors.doc_count === 0)
                continue;

            byProviderResults.push({
                label: providerMap.get(providerErrorBucket.key),
                value: providerErrorBucket.errors.doc_count,
                providerId: providerErrorBucket.key.toString(),
                facilityId: parseInt(facilityId),
            });
        }

        byErrorResults = _.orderBy(byErrorResults, ['value'], ['desc']);
        byProviderResults = _.orderBy(byProviderResults, ['value'], ['desc']);
        
        res.status(200).send({
            byError: byErrorResults,
            byProvider: byProviderResults,
        });
    }

    public getDataEntryErrorCountsForProvider = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Getting Data Entry Errors for Facility');
        const org = req.session.org;
        const startDate = req.query.startDate;
        const facilityId = req.params.facilityId;
        const providerId = req.params.providerId;

        let searchParams:Elasticsearch.SearchParams = {
            index: 'import_events_v1',
            body: {
                size: 0,
                aggs: {
                    byErrorType: {
                        nested: {
                            path: "initialDataEntryErrorFields"
                        },
                        aggs: {
                            errorTypes: {
                                terms: {
                                    field: "initialDataEntryErrorFields.error"
                                },
                                aggs: {
                                    fields: {
                                        terms: {
                                            field: "initialDataEntryErrorFields.fieldName"
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                query: {
                    bool: {
                        filter: [
                            { range: { 'createdAt': {
                                gte: startDate,
                                lte: startDate+'||/M',
                                time_zone: '-06:00'
                            }}},
                            { term: { "_type": "import_batch_record" }},
                            { term: { "orgInternalName": org }},
                            { term: { "facilityId": facilityId }},
                            { term: { "primaryResponsibleProviderId": providerId }},
                        ]
                    }
                }
            }
        }

        let results = await es.createCollectorClient().search(searchParams);
        let byErrorResults: DataEntryErrorResult[] = [];
        
        for (let errorTypeBucket of results.aggregations.byErrorType.errorTypes.buckets) {
            for (let fieldBucket of errorTypeBucket.fields.buckets) {
                byErrorResults.push({
                    facilityId: parseInt(facilityId),
                    providerId: providerId,
                    errorTypeKey: errorTypeBucket.key,
                    fieldKey: fieldBucket.key,
                    label: DataErrorUtils.getErrorLabel(errorTypeBucket.key, fieldBucket.key),
                    value: fieldBucket.doc_count,
                });
            }
        }

        byErrorResults = _.orderBy(byErrorResults, ['value'], ['desc']);
        
        res.status(200).send({
            byError: byErrorResults
        });
    }

    public getDataAnomalies = async (req:Request, res:Response, next:NextFunction) => {
        console.log('Getting Data Anomalies for Facility');
        const org = req.session.org;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const facilityId = parseInt(req.query.facilityId as string);

        let anomalyData = await EncounterFormService.getDataAnomalies({
            orgInternalName: org,
            facilityIds: [facilityId],
            startDate: startDate,
            endDate: endDate
        });
        
        res.status(200).send({
           anomalyData: anomalyData.data
        });
    }
}

export const dashboardServices = new DashboardServices().router;
//export default dashboardServices;