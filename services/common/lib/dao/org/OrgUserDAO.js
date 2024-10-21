var _ = require('lodash');
var moment = require('moment');
var orgModels = require('../../model/OrgModels.js');

function getOrgUser(orgInternalName, userName) {
    if (!userName) throw new Error('Missing parameter username');

    return orgModels
        .getModelsForOrg(orgInternalName)
        .then(function(models) {
            return models.OrganizationUser.findOne({
                where: { userName: userName },
                include: [
                    {
                        model: models.Role,
                        as: 'roles',
                        through: { attributes: [] },
                        include: [
                            {
                                model: models.Permission,
                                as: 'permissions',
                                through: { attributes: [] }
                            }
                        ]
                    },
                    {
                        // For some reason this mapping always includes an extra prvr_id in addtion to
                        // the defined providerId. We are explicilty removing it until I figure out a
                        // better way to hae sequelize manage the association to not include that (if possible).
                        model: models.Provider,
                        as: 'provider',
                        attributes: { exclude: ['prvr_id'] }
                    }
                ]
            });
        })
        .then(function(userEntity) {
            if (userEntity) {
                var user = userEntity.toJSON();
                return Promise.resolve(user);
            } else {
                return Promise.reject(new Error('User does not exist in organization.'));
            }
        });
}

function getOrgUserById(orgInternalName, userId) {
    if (!orgInternalName) throw new Error('Missing parameter orgInternalName');
    if (!userId) throw new Error('Missing parameter userId');

    return orgModels
        .getModelsForOrg(orgInternalName)
        .then(function(models) {
            return models.OrganizationUser.findOne({
                where: { userId: userId },
                include: [
                    {
                        model: models.Role,
                        as: 'roles',
                        through: { attributes: [] },
                        include: [
                            {
                                model: models.Permission,
                                as: 'permissions',
                                through: { attributes: [] }
                            }
                        ]
                    },
                    {
                        // For some reason this mapping always includes an extra prvr_id in addtion to
                        // the defined providerId. We are explicilty removing it until I figure out a
                        // better way to hae sequelize manage the association to not include that (if possible).
                        model: models.Provider,
                        as: 'provider',
                        attributes: { exclude: ['prvr_id'] }
                    }
                ]
            });
        })
        .then(function(userEntity) {
            if (userEntity) {
                var user = userEntity.toJSON();
                return Promise.resolve(user);
            } else {
                return Promise.reject(new Error('User does not exist in organization.'));
            }
        });
}

function getUsersByRoles(orgInternalName, roleNames) {
    if (!_.isArray(roleNames) && roleNames.length > 0)
        throw new Error('Missing parameter roleNames or no names defined.');

    return orgModels
        .getModelsForOrg(orgInternalName)
        .then(function(models) {
            return models.OrganizationUser.findAll({
                include: [
                    {
                        model: models.Role,
                        as: 'roles',
                        where: { roleName: roleNames },
                        through: { attributes: [] }
                    }
                ]
            });
        })
        .then(function(userEntities) {
            return Promise.resolve(
                _.map(userEntities, function(userEntity) {
                    return userEntity.toJSON();
                })
            );
        });
}

function getUsers(orgInternalName) {
    return orgModels
        .getModelsForOrg(orgInternalName)
        .then(function(models) {
            return models.OrganizationUser.findAll({
                include: [
                    {
                        model: models.Role,
                        as: 'roles',
                        through: { attributes: [] }
                    }
                ]
            });
        })
        .then(function(userEntities) {
            return Promise.resolve(
                _.map(userEntities, function(userEntity) {
                    return userEntity.toJSON();
                })
            );
        });
}

function getUsersWithFacilities(orgInternalName) {
    /*
    include: [
            { model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes: [], where: { 'actv_ind': true }} }
        ]
    */

    return orgModels
    .getModelsForOrg(orgInternalName)
    .then(function(models) {
        return models.OrganizationUser.findAll({
            include: [
                {
                    model: models.Role,
                    as: 'roles',
                    through: { attributes: [] }
                },
                {
                    model: models.Facility,
                    as: 'facilities',
                    where: { activeIndicator: true },
                    through: { attributes: [], where: { 'actv_ind': true }}
                }
            ]
        });
    })
    .then(function(userEntities) {
        return Promise.resolve(
            _.map(userEntities, function(userEntity) {
                return userEntity.toJSON();
            })
        );
    });
}

function isMigrated(orgInternalName) {

	if (!orgInternalName) throw new Error('Missing parameter orgInternalName.');
	
	var query = `SELECT * FROM _MIGRATION;`;
    var queryOptions = {
        type: "SELECT",
        replacements: {}
    };

    return orgModels.query(orgInternalName, query, queryOptions).then(function(results) {
		if(results && results.length > 0)
            return results[0];
        else 
            return null;
	})
	.catch((error) => {
		return null;
	});
}

module.exports = {
	isMigrated: isMigrated,
    getOrgUser: getOrgUser,
    getOrgUserById: getOrgUserById,
    getUsersByRoles: getUsersByRoles,
    getUsers: getUsers,
    getUsersWithFacilities: getUsersWithFacilities
};
