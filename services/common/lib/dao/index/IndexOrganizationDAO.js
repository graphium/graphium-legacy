var _ = require('lodash');
var moment = require('moment');
var indexModels = require('../../model/IndexModels.js');
var sequelize = require('sequelize');

function getAllOrgs() {

    return indexModels.getModels().Organization.findAll()
    .then(function(organizations) {
        let orgs = _.map(organizations, function(o) { return o.toJSON() });
        return Promise.resolve(orgs);
    });
}

function getOrgByOrgNameInternal(organizationNameInternal) {
    if(!organizationNameInternal) {
        return Promise.reject(new Error('Unable to retrieve organization, must specify an organizationNameInternal.'));
    }

    return indexModels.getModels().Organization.findOne({
        where: {
            organizationNameInternal: organizationNameInternal
        }
    })
    .then(function(orgModel) {
        if(orgModel) {
            return Promise.resolve(orgModel.toJSON());
        }
        return Promise.reject(new Error('Organization with name (' + organizationNameInternal + ') does not exist.'));
    });
}

module.exports = {
    getAllOrgs: getAllOrgs,
    getOrgByOrgNameInternal: getOrgByOrgNameInternal
}