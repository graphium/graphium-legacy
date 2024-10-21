var _ = require('lodash');
var moment = require('moment');
var orgModels = require('../../model/OrgModels.js');
var hstore = require('pg-hstore')();

function getValueSet(orgInternalName, valueSetName, categoryName, facilityId, withDetails) {
	if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');
	if (!valueSetName)
		throw new Error('Missing parameter valueSetName.');
    if (!categoryName)
		throw new Error('Missing parameter categoryName.');

    var valueSet = null;
	return orgModels.getModelsForOrg(orgInternalName)
    .then(function (models) {
        let whereClause = {
            facilityId: facilityId,
            valueSetName: valueSetName,
            categoryName: categoryName,
            activeIndicator: true
        };
        if(facilityId == null || categoryName == 'Global') {
            delete whereClause.facilityId;
        }

        return models.ValueSet.find({
            where: whereClause
        });
    })
    .then(function (valueSetEntity) {
        if(valueSetEntity) {
            valueSet = valueSetEntity.toJSON();
            if(withDetails) {
                switch(valueSet.valueSetType) {
                    case 'STATIC': return getStaticValueSetDetails(orgInternalName, valueSet.valueSetId);
                    case 'DYNAMIC': throw new Error('Do not currently support dynamic value set detail retrieval.');
                    default: throw new Error('Unable to determine value set type. Cannot retrieve details.');
                }
            }
            else {
                return Promise.resolve(null);
            }
        }
        else {
            return Promise.resolve(null);
        }
    })
    .then(function(valueSetDetails) {
        if(valueSet) {
            valueSet.details = valueSetDetails;
        }
        return Promise.resolve(valueSet);
    })
}

function getStaticValueSetDetails(orgInternalName, valueSetId) {
    if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');
	if (valueSetId === null)
		throw new Error('Missing parameter valueSetId.');

	return orgModels.getModelsForOrg(orgInternalName)
    .then(function (models) {
        return models.ValueSetDetail.findAll({
            where: {
                valueSetId: valueSetId,
                activeIndicator: true
            }
        });
    })
    .then(function (valueSetDetailEntities) {
        return Promise.resolve(_.map(valueSetDetailEntities,function(valueSetDetailEntity) { 
            var detail = valueSetDetailEntity.toJSON(); 
            if(detail && detail.valueList) detail.valueList = hstore.parse(detail.valueList);
            return detail;
        }));
    });
}


module.exports = {
	getValueSet: getValueSet,
    getStaticValueSetDetails: getStaticValueSetDetails
}