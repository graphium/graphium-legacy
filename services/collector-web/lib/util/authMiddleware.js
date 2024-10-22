var _ = require('lodash');
var OrgUserDAO = require('@common/lib/dao/org/OrgUserDAO.js');

var roleGroups = require('./roleGroups.js');

var getUserOrg = function(orgInternalName, user) {
    var org = _.find(user._json.gh_user.organizations, {
        organizationNameInternal: orgInternalName
    });
    return org;
}

function isUsernameGraphiumAdministrator(username) {
    return _.includes(['dd','dd2','matthew.oldham','oademo','GraphiumSupport','frankdansby', 'johnlutes','alexmihaila'], username);
}

function isGraphiumAdministrator() {
    return function(req, res, next) {

        if(isUsernameGraphiumAdministrator(req.orgUser.userName)) {
            next();
        }
        else {
            redirectOrSendError(res, req.route, 401, 'You do not have the appropriate permissions to perform this action.', '/user/restricted');
        }
    }
}

function ensureAuthenticatedIndex(options) {
    return function(req, res, next) {

        var formattedOptions = formatOptions(options);
        var url = formattedOptions.redirectTo || '/login';
        var setReturnTo = (formattedOptions.setReturnTo === undefined) ? true : formattedOptions.setReturnTo;

        if (!req.isAuthenticated || !req.isAuthenticated() || !req.session.org) {
            if (setReturnTo && req.session) {
                req.session.returnTo = req.originalUrl || req.url;
            }

            redirectOrSendError(res, req.route, 401, 'User is not authenticated.', url);
            return;
        }

        req.indexUserId = parseInt(req.user._json.gh_user.userId);

        // Setting local variables for the current user. 
        res.locals.indexUser = req.user;
        res.locals.userOrganizations = req.user._json.gh_user.organizations;
        
        next();
    }
}

function getAllPermissions(orgUser) {
    // We join together category and name using a ':'.
    return _.uniq(_.flatMap(orgUser.roles, function(role) { 
        return _.map(role.permissions, function(permission) { return [permission.categoryName,permission.permissionName].join(':'); });  
    }));
}

function hasPermission(orgUser, permission) {
    var hasPermission = _.includes(getAllPermissions(orgUser), permission);
    return hasPermission;
}

function hasEveryPermission(orgUser, permissions) {
    return _.every(permissions, function(permission,index,collection) { return hasPermission(orgUser, permission); });
}

function hasSomePermission(orgUser, permissions) {
    return _.some(permissions, function(permission,index,collection) { return hasPermission(orgUser, permission); });
}

function hasRole(orgUser, role) {
    var allRoles = _.map(orgUser.roles, 'roleName');
    return _.includes(allRoles, role);
}

function hasEveryRole(orgUser, roles) {
    return _.every(roles, function(role) { return hasRole(orgUser, role); });
}

function hasSomeRole(orgUser, roles) {
    return _.some(roles, function(role) { return hasRole(orgUser, role); });
}

function formatOptions(options) {
    // If it is a string, we specify that the user must have that string as a role.
    if (_.isString(options)) { 
        options = { roles: { every: options } }; 
    }
    // If it is an array, it is a set of 'some' roles that are available.
    else if(_.isArray(options)) { 
        options = { roles: { some: options } }; 
    }
    // Otherwise we make it a blank object if it isn't an object already, irregardless of the value.
    else if(!_.isObject(options)) { 
        options = {}; 
    }
    return options;
}

function redirectOrSendError(res, route, errorCode, errorMessage, redirectUrl) {
    console.error(errorMessage);
    if(route && _.endsWith(route.path,'.json')) {
        res.status(errorCode).send(errorMessage);
    }
    else {
        res.redirect(redirectUrl);
    }
}

function ensureAuthenticatedOrg(options) {
    return function(req, res, next) {
        var formattedOptions = formatOptions(options);

        // First we process the ensure index authenticate middleware, if it completes
        // successfully (ie. calls next())  then we make sure the user is authenticated
        // to the specified org. Otherwise we redirect them to the organization/select page.
        ensureAuthenticatedIndex(formattedOptions)(req, res, function() {

            if(!req.session.org) {
                redirectOrSendError(res, req.route, 400, 'User has not selected an organization.', '/organization/select');
                return;
            }

            OrgUserDAO.getOrgUser(req.session.org, req.user._json.gh_user.userName)
            .then(function(orgUser) {

                if(!orgUser.activeIndicator) {
                    redirectOrSendError(res, req.route, 401, 'User does not have permissiong to access this organization.');
                }

                // Let's set a cookie to remember the last org we successfully opened in case we
                // lose our session.
                res.cookie(orgUser.userName+'.lastOpenedOrg',req.session.org);

                var validPermission = true;
                if(formattedOptions.permissions && _.isArray(formattedOptions.permissions)) {
                    validPermission = hasEveryPermission(orgUser, formattedOptions.permissions);
                }
                if(formattedOptions.permissions && formattedOptions.permissions.every && _.isArray(formattedOptions.permissions.every)) {
                    validPermission = hasEveryPermission(orgUser, formattedOptions.permissions.every);
                }
                if( validPermission && formattedOptions.permissions && formattedOptions.permissions.some && _.isArray(formattedOptions.permissions.some)) {
                    validPermission = hasSomePermission(orgUser, formattedOptions.permissions.some);
                }

                var validRole = true;
                if(formattedOptions.roles && _.isArray(formattedOptions.roles.every)) {
                    validRole = hasEveryRole(orgUser, formattedOptions.roles.every);
                }
                if( validRole && formattedOptions.roles && _.isArray(formattedOptions.roles.some)) {
                    validRole = hasSomeRole(orgUser, formattedOptions.roles.some);
                }

                if(!validRole || !validPermission) {
                    redirectOrSendError(res, req.route, 401, 'You do not have the appropriate permissions to perform this action.', '/user/restricted');
                    return;
                }

                req.orgUser = orgUser;
                req.permissions = getAllPermissions(orgUser);
                req.orgUserId = parseInt(orgUser.userId);

                res.locals.orgUser = orgUser;
                res.locals.currentOrganization = getUserOrg(req.session.org, req.user);
                res.locals.permissions = getAllPermissions(orgUser);
                res.locals.isGraphiumAdministrator = isUsernameGraphiumAdministrator(orgUser.userName);
                next();
                return Promise.resolve();
            })
            .catch(function(error) {
                redirectOrSendError(res, req.route, 400, 'Error authenticating user to organization: ' + error.message, '/organization/select');
                console.error(error.stack);
            })

        });

    }

}

module.exports = {
    // Just ensures that the current user is authenticated against the
    // index database, which means that they have an active user/pass.
    ensureAuthenticatedIndex: ensureAuthenticatedIndex,
    // Ensure the user can authenticate against the currently selected
    // organization that is stored in their session.
    ensureAuthenticatedOrg: ensureAuthenticatedOrg,
    hasPermission: hasPermission,
    hasEveryPermission: hasEveryPermission,
    hasSomePermission: hasSomePermission,
    isGraphiumAdministrator: isGraphiumAdministrator,
    isUsernameGraphiumAdministrator: isUsernameGraphiumAdministrator
}