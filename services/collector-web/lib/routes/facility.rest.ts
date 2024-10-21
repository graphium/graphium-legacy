import { Router, Request, Response, NextFunction } from 'express';

import * as auth from '../util/authMiddleware';
import * as FacilityDAO from '@common/lib/dao/org/FacilityDAO';

export class FacilityServices {
    router:Router;

    constructor() {
        this.router = Router();
        this.router.get("/facilities.json", auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}), this.getFacilites.bind(this));
    }

    public getFacilites(req:Request, res:Response, next:NextFunction) {
        FacilityDAO.getFacilities(req.session.org)
            .then((facilities) => { res.status(200).send(facilities); })
            .catch((error) => { res.status(500).send('Unable to retrieve facilities: ' + error.message) })
    }
}

const facilityServices = new FacilityServices().router;

export default facilityServices;