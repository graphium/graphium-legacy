import * as _  from 'lodash';
import * as moment from 'moment';

import * as orgModels from '../../model/OrgModels.js';

export function getFacilities(orgInternalName:string, excludeFacilityInternalName:boolean = false) {
    if (!orgInternalName) throw new Error('Missing parameter orgInternalName.');

    return orgModels
        .getModelsForOrg(orgInternalName)
        .then(function(models) {
            if(excludeFacilityInternalName) {
                return models.Facility.findAll({
                    attributes: {
                        exclude: ['facilityNameInternal','testFacilityIndicator']
                    },
                })
            }
            else {
                return models.Facility.findAll();
            }
        })
        .then(function(facilityEntities) {
            return Promise.resolve(
                _.map(facilityEntities, function(facilityEntity:any) {
                    return facilityEntity.toJSON();
                })
            );
        });
}
