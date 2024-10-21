import { Router, Request, Response, NextFunction } from 'express';
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';

import * as auth from '../util/authMiddleware';
import * as FacilityDAO from '@common/lib/dao/org/FacilityDAO.js';
import * as OrgSettingDAO from '@common/lib/dao/OrgSettingDAO.js';
import * as ImportBatchTemplateDAO from '@common/lib/dao/ImportBatchTemplateDAO.js';

export class DashboardRoutes {
    router: Router;

    constructor() {
        this.router = Router();
        this.router.get(
            '/dataEntry',
            auth.ensureAuthenticatedOrg({
                roles: { some: ['ORG_ADMIN', 'DATA_ENTRY_ADMIN', 'DATA_ENTRY_SUPERVISOR'] }
            }),
            this.renderDataEntry
        );
        this.router.get(
            '/dataEntryErrors',
            auth.ensureAuthenticatedOrg({
                roles: { some: ['ORG_ADMIN', 'DATA_ENTRY_ADMIN', 'DATA_ENTRY_SUPERVISOR'] }
            }),
            this.renderDataEntryErrors
        );
        this.router.get('/pqrs', this.renderPqrs);
        this.router.get(
            '/pqrs2016',
            auth.ensureAuthenticatedOrg({ roles: { some: ['ORG_ADMIN'] } }),
            this.renderPqrs2016
        );
        this.router.get(
            '/usage',
            auth.ensureAuthenticatedOrg({ roles: { some: ['ORG_ADMIN'] } }),
            this.renderUsage
        );
        this.router.get(
            '/importBatch',
            auth.ensureAuthenticatedOrg({
                roles: { some: ['ORG_ADMIN', 'DATA_ENTRY_ADMIN', 'DATA_ENTRY_SUPERVISOR'] }
            }),
            this.renderImportBatch
        );
        this.router.get(
            '/?*/:file.js',
            auth.ensureAuthenticatedOrg({ roles: { some: ['ORG_ADMIN'] } }),
            this.renderDashboardJs
        );
        this.router.get(
            '/:file.map',
            auth.ensureAuthenticatedOrg({ roles: { some: ['ORG_ADMIN'] } }),
            this.renderDashboardSourceMap
        );
    }

    public renderDashboardJs = (req: Request, res: Response, next: NextFunction) => {
        let file = req.params.file;

        res.type('.js');
        res.sendFile(`/views/dashboards/${file}.js`, { root: __dirname + '/../' });
    };

    public renderDashboardSourceMap = (req: Request, res: Response, next: NextFunction) => {
        let file = req.params.file;
        res.sendFile(`/views/dashboards/${file}.map`, { root: __dirname + '/../' });
    };

    public renderDataEntry = (req: Request, res: Response, next: NextFunction) => {
        FacilityDAO.getFacilities(req.session.org).then(function(facilities) {
            res.render('dashboards/dataEntry', {
                facilities: facilities
            });
        });
    };

    public renderDataEntryErrors = (req: Request, res: Response, next: NextFunction) => {
        res.render('dashboards/dataEntryErrors');
    };
    public renderPqrs = (req, res, next) => {
        res.redirect('/dashboards/pqrs2016');
    };

    public renderPqrs2016 = (req: Request, res: Response, next: NextFunction) => {
        Promise.all([
            FacilityDAO.getFacilities(req.session.org),
            OrgSettingDAO.getSetting(req.session.org, '2016PqrsSignature')
        ]).then(function([facilities, pqrsSubmissionSetting]) {
            res.render('dashboards/pqrs2016', {
                facilities: facilities,
                pqrsSubmissionSetting: pqrsSubmissionSetting
            });
        });
    };

    public renderUsage = (req: Request, res: Response, next: NextFunction) => {
        return Promise.all([
            FacilityDAO.getFacilities(req.session.org),
            ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org)
        ]).then(function([facilities, importBatchTemplates]) {
            res.render('dashboards/usage', {
                facilities: _.sortBy(facilities, ['facilityName']),
                importBatchTemplates: importBatchTemplates
            });
        });
    };

    public renderImportBatch = (req: Request, res: Response, next: NextFunction) => {
        FacilityDAO.getFacilities(req.session.org).then(function(facilities) {
            res.render('dashboards/importBatch', {
                facilities: facilities
            });
        });
    };

}

export const dashboardRoutes = new DashboardRoutes().router;
