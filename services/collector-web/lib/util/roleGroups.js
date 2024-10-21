var _ = require('lodash');

var dataEntryClerkRoles =         ['DATA_ENTRY_CLERK','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN'];
var dataEntrySupervisorRoles =    ['DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN'];
var dataEntryAdministratorRoles = ['DATA_ENTRY_ADMIN'];
var allRoles = _.uniq(_.concat(dataEntryClerkRoles, dataEntrySupervisorRoles, dataEntryAdministratorRoles));

module.exports = {
  dataEntryClerkRoles: dataEntryClerkRoles,
  dataEntrySupervisorRoles: dataEntrySupervisorRoles,
  dataEntryAdministratorRoles: dataEntryAdministratorRoles,
  allRoles: allRoles
}