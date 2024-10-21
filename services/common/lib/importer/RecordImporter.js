var _ = require('lodash');
var graphium = require('@graphiumhealth/graphium-sdk');
var GraphiumServiceUtils = require('./GraphiumServiceUtils').default;
var Promise = require('bluebird');
var EncounterFormPqrsEval = require('./EncounterFormPqrsEval.js');
var EncounterFormMacraEval2017 = require('./EncounterFormMacraEval2017');
var EncounterFormMacraEval2018 = require('./EncounterFormMacraEval2018');
var EncounterFormMacraEval2019 = require('./macra2019/EncounterFormMacraEval2019').default;
var EncounterFormMacraEval2020 = require('./macra2020/EncounterFormMacraEval2020').default;
var EncounterFormMacraEval2021 = require('./macra2021/EncounterFormMacraEval2021').default;
var EncounterFormMacraEval2022 = require('./macra2022/EncounterFormMacraEval2022').default;
var EncounterFormMacraEval2023 = require('./macra2023/EncounterFormMacraEval2023').default;
var EncounterFormMacraEval2024 = require('./macra2024/EncounterFormMacraEval2024').default;

var NppesLookup = require('../services/cms/NppesLookup');
var validateNpi = require('../util/NpiValidator').default;
var OrgModels = require('../model/OrgModels');

var moment = require('moment');
require('moment-range');

function RecordImporter(importConfig, record, hideConsoleOutput) {
  this.importConfig = importConfig;
  this.validateConfig();

  this.record = record;
  this.facilityProviders = [];
  this.hideConsoleOutput = hideConsoleOutput;
}

RecordImporter.prototype.calculateOrgInternalName = function() {

  console.log(' - Calculating org internal name.');
  var hasExplicitOrgInternalName = this.importConfig.orgInternalName != null;
  var hasOrgInternalNameMapping = this.importConfig.orgInternalNameMapping != null;
  console.log('  - Has explicit org internal name: ' + hasExplicitOrgInternalName);
  console.log('  - Has org internal name mapping: ' + hasOrgInternalNameMapping);

  var explicitOrgInternalName = null;
  var mappingOrgInternalName = null;

  if(hasExplicitOrgInternalName) {
    explicitOrgInternalName = this.importConfig.orgInternalName;
  }
  if(hasOrgInternalNameMapping) {
    mappingOrgInternalName = this._executeOrgInternalNameMapping(this.record, this.importConfig.orgInternalNameMapping);
  }

  if(hasExplicitOrgInternalName && hasOrgInternalNameMapping) {
    // If both the mappign and explicit are defined, we just check to see if they match,
    // otherwise we return null.
    if(explicitOrgInternalName == mappingOrgInternalName) {
      return explicitOrgInternalName;
    }
    else {
      console.log('  - ERROR: mapping org name and explicit org name do not match!');
      return null;
    }
  }
  else {
    // If only one or the other is defined, we default to the explicit org name. Otherwise we return
    // whatever the mapping returned, which could be null or undefined.
    if(explicitOrgInternalName) {
      return explicitOrgInternalName;
    }
    else {
      return mappingOrgInternalName;
    }
  }
}

RecordImporter.prototype._executeOrgInternalNameMapping = function(record, mapping) {

  var value = this.getRecordValue(record, mapping.columnName);

  if(value == null || value === "") {
    return null;
  }

  var formattedValue = value;
  formattedValue = this._applyMappingRegex(formattedValue, mapping);
  formattedValue = this._applyMappingExpression(formattedValue, mapping, record);
  formattedValue = this._applyMappingConversion(formattedValue, mapping);

  return formattedValue;
}

RecordImporter.prototype.executeQueryForFirstRow = function(query, replacements) {
  let options = {
    type: "RAW"
  };

  if(replacements) {
    options.replacements = replacements;
  }

  return OrgModels.queryReadOnly(this.importConfig.orgInternalName, query, options).then((result) => {
    if(result && result.length > 1 && result[1].rowCount === 1) {
      console.log('Found a single row on the result: ' + JSON.stringify(result[1].rows[0]));
      return Promise.resolve(JSON.parse(JSON.stringify(result[1].rows[0])));
    }
    else {
      return Promise.resolve(null);
    }
  });
}

RecordImporter.prototype.getDefaultPageId = function(pages) {
  // NOTE: We are going to do something really bad here. If we don't find the page and the config is set
  // to defaultUpdatesToFirstPage, then we use whatever the first page is for this existing form.
  var defaultPageId = this.serviceUtils.getFirstPageIdByName(this.importConfig.pageName, pages);
  if(defaultPageId === null && this.importConfig.defaultUpdatesToFirstPage === true) {
    defaultPageId = pages[0].pageId;
  }
  return defaultPageId;
}

RecordImporter.prototype.validateConfig = function () {

  if (!this.importConfig.pageName) throw new Error('Config does not specify pageName.');
  if (!this.importConfig.formSearchName) throw new Error('Config does not specify formSearchName.');
  if (!this.importConfig.orgInternalName && !this.importConfig.orgInternalNameMapping) throw new Error('Config does not specify orgInternalName explicitly or in a mapping.');
  if (!this.importConfig.formDefinitionName) throw new Error('Config does not specify formDefinitionName.');
  if (!this.importConfig.graphiumServiceUser) throw new Error('Config does not specify graphiumServiceUser.');
  if (!this.importConfig.graphiumServiceUser) throw new Error('Config does not specify graphiumServicePass.');
  if(!this.importConfig.encounterMapping) throw new Error('Import config must specify an encounterMapping element.');
  if(!this.importConfig.encounterMapping.encounterNumber) throw new Error('Import config encounterMapping must specify an encounterNumber mapping.');
  if(!this.importConfig.formSearchMatchingCriteria && !this.importConfig.encounterFormSearchQuery) throw new Error('Import config must specify a formSearchMatchingCriteria or encounterFormSearchQuery.');
}

RecordImporter.prototype.validateMappings = function (mappings) {
  // TODO
}

RecordImporter.prototype._generateSearchParametersAndUpdates = function( encounter, record, useOldDatesForSearch ) {
  var _this = this;
  var searchParameters = [];
  var updatesForFormCreation = [];

  searchParameters.push({
    parameterName: 'fac_id',
    parameterValue: parseInt(encounter.facilityId)
  });
  if(this.importConfig.ignoreFormDefinitionNameInFormSearch!== true) {
    searchParameters.push({
      parameterName: 'form_defn_nm',
      parameterValue: this.importConfig.formDefinitionName
    });
  }
  searchParameters.push({
    parameterName: 'enctr_enctr_no',
    parameterValue: encounter.encounterNumber
  });
  searchParameters.push({
    parameterName: 'enctr_form_void_ind',
    parameterValue: false
  });

  for (var matchingCriteriaName in this.importConfig.formSearchMatchingCriteria) {
    var matchingCriteriaArray = this.importConfig.formSearchMatchingCriteria[matchingCriteriaName];
    if(!_.isArray(matchingCriteriaArray)) {
      matchingCriteriaArray = [matchingCriteriaArray];
    }

    var createdCriteriaForNotNullValue;
    _.forEach(matchingCriteriaArray, function(matchingCriteria) {

      console.log('Generating search criteria: ' + matchingCriteria.columnName);

      var value;
      if(matchingCriteria.hasOwnProperty('value')) {
        value = matchingCriteria.value;
      }
      else {
        value = _this.getRecordValue(record, matchingCriteria.columnName);
      }

      var modelValue = value;

      console.log('  -- Unformatted value: ' + modelValue);
      modelValue = _this._applyMappingRegex(modelValue, matchingCriteria);
      console.log('  -- After applying regex: ' + modelValue);
      modelValue = _this._applyMappingExpression(modelValue, matchingCriteria, record);
      console.log('  -- After applying expression: ' + modelValue);
      modelValue = _this._applyMappingConversion(modelValue, matchingCriteria);
      console.log('  -- After applying conversion: ' + modelValue);

      if (!modelValue || modelValue == "") { // || createdCriteriaForNotNullValue) {
        console.log('  -- Skipping matching criteria, value is null or empty.');
        return;
        //console.error(`Unable to generate matching criteria for form search, criteria (${matchingCriteriaName}) does not contain a value.`);
        //throw new Error(`Unable to generate matching criteria for form search, criteria (${matchingCriteriaName}) does not contain a value.`);
      }

      createdCriteriaForNotNullValue = true;

      if (matchingCriteria.searchParameterType == 'date') {

        if(useOldDatesForSearch) {
          console.log('  -- Applying old date logic to: ' + modelValue)
          var date = moment(new Date(modelValue));
          if (date.isValid()) {
            console.log('    -- Date is valid: ' + date.toString());
            value = {
              lowerBounds: date.format('YYYY-MM-DD'),
              upperBounds: date.format('YYYY-MM-DD')
            };
            modelValue = date.format('YYYY-MM-DD') + 'T00:00:00.0Z';
            console.log('    -- Formatted date to: ' + modelValue);
          }
          else {
            //console.error('Unable to generate matching criteria for form search, invalid date.');
            throw new Error('Attempting to parse invalid date for matching criteria.');
          }
        }
        else {
          console.log('  -- Applying updated date logic to: ' + modelValue);
          console.log('    -- Extracting date, using sourceDateTimeFormat: ' + matchingCriteria.sourceDateTimeFormat);
          var date = safeExtractDate(modelValue, matchingCriteria.sourceDateTimeFormat);
          if(!date) {
            console.log('    -- Unable to extract date.');
            throw new Error('Unable to extract date for form search.');
          }
          else {
            console.log('    -- Extracted date: ' + date);
            value = {
              lowerBounds: date,
              upperBounds: date
            }
            modelValue = date;
          }
        }
      }
      else if (matchingCriteria.searchParameterType == 'time') {
        var time = safeExtractTime(modelValue.toString());
        if (time != null) {
          value = {
            lowerBounds: time,
            upperBounds: time
          };
          modelValue = '1900-01-01T' + time + 'Z';
        }
        else {
          console.log('Unable to generate matching criteria for form search, invalid time.');
          throw new Error('Unable to generate matching criteria for form search, invalid time.');
        }
      }
      else {
        value = modelValue;
      }

      searchParameters.push({
        parameterName: matchingCriteriaName,
        parameterValue: value
      });

      updatesForFormCreation.push({
        propertyName: matchingCriteriaName,
        fieldValue: modelValue,
        percentComplete: 0,
        formValid: false
      });
    });

    if(!createdCriteriaForNotNullValue)
      throw new Error(`Unable to generate matching criteria for form search, no criteria for (${matchingCriteriaName}) contained a value.`);

  }

  return {
    searchParameters: searchParameters,
    updatesForFormCreation: updatesForFormCreation
  };
}

RecordImporter.prototype.findExistingForm = function( encounter, record, generatedParametersAndUpdates ) {
  var _this = this;

  if(_this.importConfig.encounterFormSearchQuery) {
    console.log('Searching for existing encounter form via query.');

    let replacements = _this.importConfig.encounterFormSearchQuery.replacements || {};
    replacements.facilityId = encounter.facilityId;
    replacements.encounterNumber = encounter.encounterNumber;
    replacements.encounterId = encounter.encounterId;

    return _this.executeQueryForFirstRow(_this.importConfig.encounterFormSearchQuery.query, replacements)
    .then(function(result) {
      if(result && !Number.isNaN(parseInt(result.encounterFormId))) {
        console.log('- Found encounter form (' + result.encounterFormId + ').');
        return Promise.resolve(parseInt(result.encounterFormId));
      }
      else {
        console.log('- Unable to find encounterFormId via query.');
        return Promise.resolve(null);
      }
    })
  }
  else {
    console.log('Searching for existing form using matching criteria.');

    console.log('- Searching using criteria: ');
    _.forEach(generatedParametersAndUpdates.searchParameters, function(parameter) { console.log(' - ' + parameter.parameterName + ': ' + JSON.stringify(parameter.parameterValue)) });
    _this.results.generatedPrimaryFormSearchParametersAndUpdates = generatedParametersAndUpdates

    return this.serviceUtils.getSearchResultsBySearchName(this.importConfig.formSearchName, generatedParametersAndUpdates.searchParameters)
      .then(function(searchResults) {
        if(!searchResults || searchResults.length == 0) {
          // If the search with the old dates doesn't return a form, try with the current date formats.'
          generatedParametersAndUpdates = _this._generateSearchParametersAndUpdates(encounter, record, false);
          _this.results.generatedSecondaryFormSearchParametersAndUpdates = generatedParametersAndUpdates;
          console.log('- Searching again using criteria: ');
          _.forEach(generatedParametersAndUpdates.searchParameters, function(parameter) { console.log(' - ' + parameter.parameterName + ': ' + JSON.stringify(parameter.parameterValue)) });
          return _this.serviceUtils.getSearchResultsBySearchName(_this.importConfig.formSearchName, generatedParametersAndUpdates.searchParameters);
        }
        else {
          return Promise.resolve(searchResults);
        }
      })
      .then(function (searchResults) {
        if (searchResults.length == 0) {
          console.log('- No forms found matching the criteria.');
          return Promise.resolve(null);
        }
        else if (searchResults.length == 1) {
          console.log('- Found form using matching criteria, encounterFormId: ' + searchResults[0].enctr_form_id);
          return Promise.resolve(searchResults[0].enctr_form_id);
        }
        else {
          console.log('Unable to identify matching form, found multiple forms that meet the matching criteria.');
          return Promise.reject(new Error('Found multiple forms that meet the matching criteria, please fix the forms in this encounter.'));
        }
      });
  }
}

RecordImporter.prototype.findOrCreateForm = function (encounter, record) {
  var _this = this;
  var encounterForm;
  var formAction;

  var generatedParametersAndUpdates = _this._generateSearchParametersAndUpdates(encounter, record, true);

  return this.findExistingForm(encounter, record, generatedParametersAndUpdates)
  .then(function(encounterFormId) {

      if (encounterFormId === null) {
        console.log('Unable to find form using criteria, creating encounter form.');
        formAction = 'createForm';
        if(_this.importConfig.abortIfFormNotFound) {
          return Promise.reject(new Error('Skipping record, existing form not found.'));
        }

        return _this.serviceUtils.createEncounterForm(encounter.facilityId, encounter.encounterId, _this.importConfig.formDefinitionName)
          .then(function (createEncounterFormResult) {
            console.log('Form created, encounterFormId: ' + createEncounterFormResult.result.encounterFormId);
            _this.results.events.push({type:'ENCOUNTERFORM_CREATE',encounterFormId:createEncounterFormResult.result.encounterFormId});
            return Promise.resolve(createEncounterFormResult.result.encounterFormId);
          })
          .catch(function (error) {
            console.log('Unable to create form: ' + error.message);
            return Promise.reject(error);
          })
      }
      else {
        console.log('Found form using matching criteria, encounterFormId: ' + encounterFormId);
        formAction = 'none';
        return Promise.resolve(encounterFormId);
      }
    })
    .then(function (encounterFormId) {
      if(formAction == 'createForm') {
        console.log('Updating form to match search criteria so we don\'t create it again.');
        // Yeah we nest the promise so that we can return the same encounterFormId to the next then. I hate promises.
        return _this.serviceUtils.formService.updateEncounterFormModel(encounterFormId, generatedParametersAndUpdates.updatesForFormCreation)
        .then(function(formUpdateVersion) {
          _this.results.events.push({type:'ENCOUNTERFORM_UPDATE',encounterId:encounter.encounterId,encounterFormId:encounterFormId,updatedFormVersion:formUpdateVersion.result});
          return Promise.resolve(encounterFormId);
        })
      }
      else {
        return Promise.resolve(encounterFormId);
      }
    })
    .then(function(encounterFormId) {
      console.log('Loading encounter form with pages and data.');
      return _this.serviceUtils.formService.getEncounterFormById(encounterFormId, false, true);
    })
    .then(function (encounterFormResult) {
      console.log('Getting form definition with content.');
      encounterForm = encounterFormResult.result;
      return _this.serviceUtils.getCachedFormDefinitionWithContent(encounterForm.formDef.formDefinitionId, encounterForm.formDef.formDefinitionVersion);
    })
    .then(function (formDefinitionWithContentResult) {
      console.log('Completed loading encounter form and form definition.');
      encounterForm.formDef = formDefinitionWithContentResult;
      return Promise.resolve(encounterForm);
    });
}

RecordImporter.prototype.createForm = function (encounter) {
  var encounterForm = {
    encounterId: encounter.encounterId,
    formDefinitionId: this.targetFormDefinition.formDefinitionId,
    formDefinitionVersion: this.targetFormDefinition.formDefinitionVersion
  };
}

RecordImporter.prototype._generateEncounterMappingValue = function(record, encounterMapping) {
    var value;

    if(encounterMapping.hasOwnProperty('value')) {
      value = encounterMapping.value;
    }
    else {
      value = this.getRecordValue(record, encounterMapping.columnName);
    }

    if(value == null || value === "") {
      return null;
    }

    var formattedValue = value;
    formattedValue = this._applyMappingRegex(formattedValue, encounterMapping);
    formattedValue = this._applyMappingExpression(formattedValue, encounterMapping, record);
    formattedValue = this._applyMappingConversion(formattedValue, encounterMapping);

    if (encounterMapping.dataType == "date") {
      formattedValue = safeExtractDate(formattedValue, encounterMapping.sourceDateTimeFormat);
    }
    else if (encounterMapping.dataType == "int") {
      formattedValue = parseInt(formattedValue);
    }

    return formattedValue;
}

RecordImporter.prototype.generateEncounterFromRecord = function (record) {
  var _this = this;
  var encounter = {};

  // First default facility ID to the one set in the import config, if set. This is not
  // a required property, and can also be set in a mapping so that it will be generated
  // based on the content of the record. If both are set, the mapping will override this
  // value.
  if(_.isInteger(this.importConfig.facilityId))
    encounter.facilityId = this.importConfig.facilityId;

  console.log('- Executing encounter mappings.');
  for (var encounterMappingName in this.importConfig.encounterMapping) {
    var encounterMapping = this.importConfig.encounterMapping[encounterMappingName];
    var encounterMappingValue = null;

    // If you specify an array of encounter mappings, we will coalesce the mappings
    // and use the first not null mapping.
    if(_.isArray(encounterMapping)) {
      var mappings = encounterMapping.concat();
      while(encounterMappingValue == null && mappings.length > 0) {
        encounterMappingValue = _this._generateEncounterMappingValue(record, mappings.shift());
      }
    }
    // Otherwise you can just specify a single mapping.
    else {
      encounterMappingValue = _this._generateEncounterMappingValue(record, encounterMapping);
    }
    console.log(' - Setting encounter property: ' + encounterMappingName + ' => ' + encounterMappingValue);
    encounter[encounterMappingName] = encounterMappingValue;
  }


  if (!encounter.encounterNumber)
    throw new Error('encounter number not set in record.');
  if (!encounter.facilityId)
    throw new Error('encounter facility ID not set in record.');

  // Let's replace forward slashes in the encounter number
  // with colon.
  encounter.encounterNumber = encounter.encounterNumber.replace('/', ':');

  return encounter;
}

RecordImporter.prototype.getRecordValue = function (record, propertyName) {
  if (!propertyName)
    return null;

  var propertyNameLowercase = propertyName.toLowerCase();
  for (var attr in record) {
    if (attr.toLowerCase() == propertyNameLowercase) {
      var value = record[attr];
      if(value === "") value = null;
      return value;
    }
  }

  return null;
}

RecordImporter.prototype.createProviderByNpi = function(facilityId, npi, providerType, inferAnesthesiaProviderType) {
  var _this = this;
  return new Promise(function(resolve, reject) {
    console.log(' - Creating provider, validating NPI: ' + npi);

    /*
    if(!providerType) {
      console.log(' - Unable to create provider, provider type not specified.');
      reject(new Error('Unable to create new provider without a provider type specified in mapping.'));
    }
    */

    var isNpiValid = validateNpi(npi);
    if(!isNpiValid) {
      console.log(' - NPI does not pass checksum.');
      reject(new Error(`Provider not found for ${JSON.stringify(npi)}. Unable to create provider as NPI is invalid.`));
    }
    else {
      console.log(' - NPI valid, passes checksum. Looking up in NPPES database.');
      return NppesLookup.lookupIndividualProvider(npi)
      .then(function(npiLookupResult) {
        console.log(' - Found provider in NPPES database.');

        console.log(' - Attempting to determine provider type for created NPI: ' + JSON.stringify(providerType));
        if(inferAnesthesiaProviderType === true) {
          // First we lookup the primary taxonomy for this NPI
          var primaryTaxonomy = null;
          if(npiLookupResult.taxonomies && npiLookupResult.taxonomies.length > 0) {
            var pt = _.find(npiLookupResult.taxonomies,function(t) { return t.primary; });
            if(pt) {
              primaryTaxonomy = pt.desc;
            }
          }

          // We also lookup the basic credential
          var basicCredential = npiLookupResult.basic.credential;

          if(primaryTaxonomy == 'Anesthesiology' || basicCredential == 'MD' || basicCredential == 'D.O.') {
            providerType = 'MDA';
          }
          else if(primaryTaxonomy == 'Nurse Anesthetist, Certified Registered') {
            providerType = 'CRNA';
          }
        }

        let provider = {
          firstName: npiLookupResult.basic.first_name,
          lastName: npiLookupResult.basic.last_name,
          nationalProviderId: npi,
          providerType: _.toUpper(providerType),
          facilityId: facilityId,
          speciality: 'UNKNOWN',
          localProviderId: npi,
          activeIndicator: true
        }
        console.log(' - Creating provider in Graphium facility: ' + JSON.stringify(provider));

        return _this.serviceUtils.facilityService.createProvider(facilityId, provider);
      })
      .then(function(createProviderResult) {
        console.log(' - Created provider: ' + createProviderResult.result.providerId);
        console.log(' - Retrieving provider: ' + JSON.stringify({facilityId, npi, providerType}));
        _this.serviceUtils.clearCachedProviders(facilityId);
        return _this.serviceUtils.getProviderByNpi(facilityId, npi, providerType);
      })
      .then(function(getProviderResult) {
        console.log(' - Retrieved provider.');
        resolve(getProviderResult);
      })
      .catch(function(error) {
        reject(error);
      })
    }
  });
}

RecordImporter.prototype.executeProviderMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {
  var _this = this;
  console.log(' - Executing provider mapping for value: ' + inputValue);
  var value = inputValue;
  var defaultPageId = this.getDefaultPageId(encounterForm.pages);
  var modelUtil = new graphium.ModelUtil(modelDefinition);
  var mappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: value,
    convertedValue: undefined
  };

  if(!value) {
    if(modelColumnMapping.validate == 'notNull') {
      mappingResult.valid = false;
    }
    return Promise.resolve(mappingResult);
  }

  var getProviderFunction = this.serviceUtils.getProviderByNpi;
  if(modelColumnMapping.lookupType == 'providerId') {
    getProviderFunction = this.serviceUtils.getProviderById;
  }
  else if(modelColumnMapping.lookupType == 'lastName') {
    getProviderFunction = this.serviceUtils.getProviderByLastName;
  }
  else if(modelColumnMapping.lookupType == "lastNameAndFirstName") {
    getProviderFunction = this.serviceUtils.getProviderByLastNameAndFirstName;
  }

  return getProviderFunction.call(this.serviceUtils, encounter.facilityId, value, modelColumnMapping.providerType)
    .then(function (iniitalProviderSearchResult) {

      if(getProviderFunction == _this.serviceUtils.getProviderByNpi && modelColumnMapping.createProviderByNpiIfNotFound && !iniitalProviderSearchResult) {
        return _this.createProviderByNpi(encounter.facilityId, value, modelColumnMapping.providerType, modelColumnMapping.inferAnesthesiaProviderType);
      }
      else {
        return Promise.resolve(iniitalProviderSearchResult);
      }
    })
    .then(function (finalProviderSearchResult) {
      if (!finalProviderSearchResult) {
        console.log(' - Provider mapping provider not found for: ' + value);
        mappingResult.hasError = true;
        mappingResult.error = new Error(`Provider not found for ${JSON.stringify(value)}.`);
        mappingResult.valid = false;
        console.log('  - ' + mappingResult.error.message);
        return Promise.resolve([]);
      }
      else {
        console.log(' - Provider mapping provider found: ' + finalProviderSearchResult);
        var updates = [];
        var name = finalProviderSearchResult ? finalProviderSearchResult.lastName.substring(0, 10) + '-' + finalProviderSearchResult.nationalProviderId.substring(finalProviderSearchResult.nationalProviderId.length - 5) : null;
        var providerType = finalProviderSearchResult ? finalProviderSearchResult.providerType : null;
        var providerId = finalProviderSearchResult ? finalProviderSearchResult.providerId : null;

        var providerIdSequenceNumber = modelColumnMapping.providerIdSequenceNumber == "#index" ? index : modelColumnMapping.providerIdSequenceNumber;
        var providerNameSequenceNumber = modelColumnMapping.providerNameSequenceNumber == "#index" ? index : modelColumnMapping.providerNameSequenceNumber;
        var providerTypeSequenceNumber = modelColumnMapping.providerTypeSequenceNumber == "#index" ? index : modelColumnMapping.providerTypeSequenceNumber;

        mappingResult.convertedValue = "name:"+name+", providerType:"+providerType+", providerId:"+providerId;
        updates.push(modelUtil.formatModelPropertyUpdate(modelColumnMapping.providerIdModelProperty, providerId, providerIdSequenceNumber, defaultPageId));
        updates.push(modelUtil.formatModelPropertyUpdate(modelColumnMapping.providerNameModelProperty, name, providerNameSequenceNumber, defaultPageId));
        if (_.toLower(modelColumnMapping.providerType) != "surgeon")
          updates.push(modelUtil.formatModelPropertyUpdate(modelColumnMapping.providerTypeModelProperty, providerType, providerTypeSequenceNumber, defaultPageId));

        return Promise.resolve(updates);
      }
    })
    .then(function(updates) {
      mappingResult.updates = updates;
      return Promise.resolve(mappingResult);
    })
    .catch(function(error) {
      mappingResult.hasError = true;
      mappingResult.error = error;
      console.log(' - Unable to execute provider mapping: ' + error.message);
      return Promise.resolve(mappingResult);
    })
}

function splitAndCleanList(list) {
    if(list) {
        return _.map(_.split(list,','), _.trim);
    }
    return [];
}

RecordImporter.prototype.executeBooleanMultiSelectGroupMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {
  var _this = this;
  console.log(' - Executing booleanMultiSelectGroup mapping for value: ' + inputValue);
  var value = inputValue;
  var defaultPageId = this.getDefaultPageId(encounterForm.pages);
  var modelUtil = new graphium.ModelUtil(modelDefinition);
  var mappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: value,
    convertedValue: undefined
  };

  var defaultPageId = this.getDefaultPageId(encounterForm.pages);
  var modelUtil = new graphium.ModelUtil(modelDefinition);

  var modelProperties = _.keys(modelColumnMapping.modelPropertyConversion);
  if(!modelProperties || modelProperties.length == 0) {
    return Promise.resolve(mappingResult);
  }

  var delimiter = modelColumnMapping.delimiter;
  if (delimiter == null) {
    mappingResult.hasError = true;
    mappingResult.error = new Error('Unable to execute mapping, mapping does not specify a delimiter.');
    return Promise.resolve(mappingResult);
  }

  var values = _.isString(value) && value.length > 0 ? _.map(value.split(delimiter), function(v) { return v.toLowerCase(); }) : [];
  console.log('  - Selected values: ' + JSON.stringify(values));

  // If there are no values in the list, let's just set everything to false.
  mappingResult.updates = [];
  _.forIn(modelColumnMapping.modelPropertyConversion, function(modelProperty, selectValue) {
    var isSelected = _.includes(values, selectValue.toLowerCase());
    console.log('    - Creating update for ' + modelProperty + ': ' + isSelected);
    mappingResult.updates.push(modelUtil.formatModelPropertyUpdate(modelProperty, isSelected));
  });

  return Promise.resolve(mappingResult);
}


RecordImporter.prototype.executeModelMapSelectGroupMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName) {
  var _this = this;

  var value = inputValue;
  var mappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: undefined,
    convertedValue: undefined
  };

  var modelMapKeyProperty = modelColumnMapping.modelMapKeyProperty;
  var modelMapValueProperty = modelColumnMapping.modelMapValueProperty;
  var selectionIndicatedModelProperty = modelColumnMapping.selectionIndicatedModelProperty;
  var defaultPageId = this.getDefaultPageId(encounterForm.pages);

  console.log(' - Converting columns to keys.');
  var rawKeys = _.flatten(_.map(modelColumnMapping.columns, function (columnName) {
    console.log('   - Converting column: ' + columnName);
    if(modelColumnMapping.columnNameAsKey) {
      console.log('   - Using column name as key.');
      var value = _this.getRecordValue(record, columnName);
      return modelColumnMapping.columnInclusionIndicator === value ? columnName : null;
    }
    else {
      console.log('   - Using column value as key.');
      var value = _this.getRecordValue(record, columnName);
      if(value && modelColumnMapping.columnDelimiter) {
        console.log('   - Found delimiter, splitting column value: ' + value);
        var values = value.toString().split(modelColumnMapping.columnDelimiter);
        return values;
      }
      else {
        return value;
      }
    }
  }));
  // If the passed in value is an array, we concat that to the keys pulled from
  // the mapping 'columns' property we just aggregated.
  if(_.isArray(inputValue)) {
    rawKeys = rawKeys.concat(inputValue);
  }
  // Remove any null values or empty keys.
  var keys = _.compact(_.map(rawKeys, _.trim));
  console.log(' - Completed generating keys: '+JSON.stringify(keys));

  // If a key conversion exists, perform the conversion.
  if(modelColumnMapping.mapKeyConversion) {
    var lowercaseConversion = _.mapKeys(modelColumnMapping.mapKeyConversion, function(value, key) {
      return key.toLowerCase();
    });

    keys = _.map(keys, function(key) {
      if(lowercaseConversion.hasOwnProperty(key.toLowerCase()))
        return lowercaseConversion[key.toLowerCase()];
      return null;
    });

    // Remove any keys where a conversion didn't occur.
    keys = _.compact(keys);
    console.log(' - Converted keys: '+JSON.stringify(keys));
  }

  mappingResult.originalValue = mappingResult.convertedValue = keys.join(',');

  var generatedSequenceNumbers = [];
  var sequenceNumbers = _.map(keys, function (modelMapKey) {
    var sn = parseInt(_this.serviceUtils.getOrGenerateSequenceNumberForProperty(encounterForm, modelMapKeyProperty, modelMapKey, generatedSequenceNumbers));
    generatedSequenceNumbers.push(sn);
    return sn;
  });

  var updates = [];
  var modelUtil = new graphium.ModelUtil(modelDefinition);
  _.map(keys, function(key, index, coll) {
    // Add key property.
    updates.push(modelUtil.formatModelPropertyUpdate(modelMapKeyProperty, key, sequenceNumbers[index], defaultPageId));
    // Add value property to set value to 'true' to indicate that the complication is selected.
    updates.push(modelUtil.formatModelPropertyUpdate(modelMapValueProperty, true, sequenceNumbers[index], defaultPageId));
  });

  // Now we need to set any complications that are currently selected but not in our
  // spreadsheet to false.
  var existingSequenceNumbers = this.serviceUtils.getAllSequenceNumbersForModelMapKey(encounterForm, modelMapKeyProperty);
  var sequenceNumbersToDeactivate = _.difference(existingSequenceNumbers, sequenceNumbers);
  _.map(sequenceNumbersToDeactivate, function(sequenceNumber) {
    updates.push(modelUtil.formatModelPropertyUpdate(modelMapValueProperty, false, sequenceNumber, defaultPageId));
  })

  if(selectionIndicatedModelProperty) {
    updates.push(modelUtil.formatModelPropertyUpdate(selectionIndicatedModelProperty, keys.length > 0));
  }

  mappingResult.updates = updates;
  return Promise.resolve(mappingResult);
}

RecordImporter.prototype.executeValueLookup = function (record, valueLookup) {
  var formattedValue = record[valueLookup.columnName];

  formattedValue = _this._applyMappingRegex(formattedValue, valueLookup);
  formattedValue = _this._applyMappingExpression(formattedValue, valueLookup, record);
  formattedValue = _this._applyMappingConversion(formattedValue, valueLookup);

  return formattedValue;
}

RecordImporter.prototype.executeDefaultMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {

  var mappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: inputValue,
    convertedValue: undefined
  };

  var modelProperty = modelColumnMapping.modelProperty;
  var hasSequenceNumber = modelColumnMapping.hasOwnProperty('sequenceNumber');

  var sequenceNumber = parseInt(modelColumnMapping.sequenceNumber);
  if(modelColumnMapping.sequenceNumber == '#index' ) {
    sequenceNumber = index;
  }
  hasSequenceNumber = !Number.isNaN(sequenceNumber);

  var defaultPageId = this.getDefaultPageId(encounterForm.pages);

  var modelUtil = new graphium.ModelUtil(modelDefinition);
  var modelPropertyType = modelUtil.getModelPropertyType(modelProperty);

  if (hasSequenceNumber && defaultPageId === null) {
    mappingResult.valid = false;
    mappingResult.hasError = true;
    mappingResult.error = new Error('Attempting to set model property with sequence number, but page (' + this.importConfig.pageName + ') does not exist.');
  }

  if (!modelPropertyType) {
    mappingResult.valid = false;
    mappingResult.hasError = true;
    mappingResult.error = new Error('Unable to generate model property for column mapping, model property (' + modelProperty + ') does not exist.');
  }

  // We are doing this to convert from the spreadsheet date/time formats to our own
  // format taht will work with the model property util. We need to expand the model
  // util to support these at some point. TODO
  var value = inputValue;
  switch (modelPropertyType) {
    case "date": value = safeExtractDate(value, modelColumnMapping.sourceDateTimeFormat); break;
    case "time": value = safeExtractTime(value); break;
  }

  if(modelColumnMapping.validate == 'notNull') {
    mappingResult.valid = value !== null;
  }

  mappingResult.convertedValue = value;
  mappingResult.updates = [modelUtil.formatModelPropertyUpdate(modelProperty, value, sequenceNumber, defaultPageId)];
  return Promise.resolve(mappingResult);
}

RecordImporter.prototype.executeCoalesceMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {
  var _this = this;

  var defaultMappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: inputValue,
    convertedValue: undefined
  };

  var columnValues = _.compact(_.map(modelColumnMapping.columns, function (columnName) {
    console.log('   - Coalescing column: ' + columnName);
    var value = _this.getRecordValue(record, columnName);
    if(value != null && value != "")
      return value;
  }));

  if(modelColumnMapping.lookupValues) {
    for(var valueLookup of modelColumnMapping.lookupValues) {
      columnValues.push(_this.executeValueLookup(record, valueLookup));
    }
  }

  columnValues = _.compact(columnValues);

  // If none of the columns have a value, we use null.
  var coalescedValue = columnValues.length == 0 ? null : columnValues;
  if(coalescedValue !== null && modelColumnMapping.passAllValuesToMapping !== true) {
    coalescedValue = coalescedValue[0];
  }
  return _this._executeMapping(record, coalescedValue, encounter, encounterForm, modelDefinition, modelColumnMapping.mapping, mappingName, index);
}

RecordImporter.prototype.executeSplitMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {
  var _this = this;
  var delimiter = modelColumnMapping.delimiter;
  var trim = modelColumnMapping.hasOwnProperty('trim') ? modelColumnMapping.trim == true || modelColumnMapping.trim == 'true' : true;
  var defaultMappingResult = {
    updates: [],
    valid: true,
    hasError: false,
    error: null,
    originalValue: inputValue,
    convertedValue: undefined
  };

  console.log(' - Executing split mapping.');
  if(!inputValue) {
    console.log(' - Input value empty, skipping mapping.');
    return Promise.resolve(defaultMappingResult);
  }

  var inputValues = inputValue.split(delimiter);
  if(!inputValues || inputValues.length == 0) {
    console.log('Split values are empty, skipping mapping.')
    return Promise.resolve(defaultMappingResult);
  }

  var forEachPromise = Promise.resolve();
  var promiseIndex = -1;
  if(modelColumnMapping.forEach) {
    console.log(' - Found forEach mappings.');
    forEachPromise = Promise.mapSeries(inputValues, function(v) {
      console.log('   - Executing forEach mapping with value: ' + v);
      return _this._executeMapping(record, _.trim(v), encounter, encounterForm, modelDefinition, modelColumnMapping.forEach, mappingName, promiseIndex++);
    });
  }

  var byIndexPromise = Promise.resolve();
  if(modelColumnMapping.byIndex) {
    console.log(' - Found byIndex mappings.');
    byIndexPromise = Promise.mapSeries(modelColumnMapping.byIndex, function(byIndexMapping) {
      var index = byIndexMapping.index;
      console.log('   - Executing byIndex mapping for index: ' + index);
      if(!_.isInteger(index) || index > inputValues.length-1) {
        console.log('   - Skipping byIndex mapping, split result does not contain index: ' + index );
        return Promise.resolve(defaultMappingResult);
      }
      else {
        var indexValue = inputValues[index];
        console.log('   - Executing byIndex mapping with value: ' + indexValue);
        return _this._executeMapping(record, indexValue, encounter, encounterForm, modelDefinition, byIndexMapping.mapping, mappingName, index);
      }
    });
  }

  return Promise.all([forEachPromise, byIndexPromise])
  .spread(function(forEachResults, byIndexResults) {
    console.log(' - Completed all split mappings:');
    return Promise.resolve( _.concat( _.flatten(_.compact(forEachResults)), _.flatten(_.compact(byIndexResults))));
  });
}

RecordImporter.prototype._executeMapping = function (record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index) {
  var _this = this;

  if (_.isArray(modelColumnMapping)) {
    return Promise.mapSeries(modelColumnMapping, function (mapping) {
      return _this._executeMapping(record, inputValue, encounter, encounterForm, modelDefinition, mapping, mappingName, index);
    })
    .then(function (mappingResults) {
      var results = _.flatten(_.compact(mappingResults));
      return Promise.resolve(results);
    });
  }

  var formattedValue = inputValue;
  if(modelColumnMapping.hasOwnProperty('value')) {
    formattedValue = modelColumnMapping.value;
  }

  formattedValue = _this._applyMappingRegex(formattedValue, modelColumnMapping);
  formattedValue = _this._applyMappingExpression(formattedValue, modelColumnMapping, record);
  formattedValue = _this._applyMappingConversion(formattedValue, modelColumnMapping);

  // If skipIfNotSet is true, we skip this mapping if the value isn't set
  var skipIfNotSet = _this.importConfig.modelColumnMapping.skipIfNotSet === true;
  if(skipIfNotSet && (formattedValue == null || formattedValue === '')) {
    return Promise.resolve({
      updates: [],
      valid: true,
      hasError: false,
      error: null,
      originalValue: inputValue,
      formattedValue: formattedValue,
      convertedValue: undefined,
      skipped: true
    })
  }

  // Generate updates for the specified mapping type. Defaults to a mapping
  // that will determine the conversion based on the model property type.
  switch (modelColumnMapping.mappingType) {
    case "provider": {
      return _this.executeProviderMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
    case "modelMapSelectGroup": {
      return _this.executeModelMapSelectGroupMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
    case "split": {
      return _this.executeSplitMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
    case "coalesce": {
      return _this.executeCoalesceMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
    case "booleanMultiSelectGroup": {
      return _this.executeBooleanMultiSelectGroupMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
    default: {
      return _this.executeDefaultMapping(record, formattedValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName, index);
    }
  }
}

RecordImporter.prototype.executeMappings = function (encounter, encounterForm, modelDefinition, record) {
  var _this = this;
  var modelPropertyUpdates = [];
  var completedMappings = [];
  console.log('Executing column mappings.');
  return Promise.mapSeries(Object.keys(this.importConfig.modelColumnMapping), function (mappingName) {

    console.log('- Executing mapping: ' + mappingName);
    var modelColumnMapping = _this.importConfig.modelColumnMapping[mappingName];
    var inputValue = _this.getRecordValue(record, mappingName);

    return _this._executeMapping(record, inputValue, encounter, encounterForm, modelDefinition, modelColumnMapping, mappingName)
    .then(function(mappingResult) {
      if(_.isArray(mappingResult)) {
        _.each(mappingResult, function(result) { result.mappingName = mappingName; });
      }
      else {
        mappingResult.mappingName = mappingName;
      }
      return Promise.resolve(mappingResult);
    })
    .then(function(mappingResult) {
      console.log('  - Completed mapping.');// + JSON.stringify(mappingResult));
      return Promise.resolve(mappingResult);
    })
  })
  .then(function(mappingResults) {
    return Promise.resolve(_.flatten(mappingResults));
  })
}


RecordImporter.prototype._applyMappingRegex = function(value, modelColumnMapping) {

  if (value && modelColumnMapping.regex) {
    var regexp = new RegExp(modelColumnMapping.regex);
    var groups = regexp.exec(value.toString());
    if (groups && groups.length > 1) {
      return groups[1];
    }
    else {
      console.warn('  - Executing regex on mapping, no match found. Defaulting to null.');
      return null;
    }
  }

  return value;
}


RecordImporter.prototype._applyMappingExpression = function(value, modelColumnMapping, record) {
  // Handle conversion if defined in mapping.
  console.log('Running expression mapping: ' );
  console.log(' - value: ' + value);
  console.log(' - mapping: ' + JSON.stringify(modelColumnMapping));
  if (modelColumnMapping.expression && _.isFunction(modelColumnMapping.expression)) {
    console.log(' - .expression is a function.');
    return modelColumnMapping.expression.call(this, value, modelColumnMapping, record);
  }
  console.log(' - returning value: ' + value);
  return value;
}

RecordImporter.prototype._applyMappingConversion = function(value, modelColumnMapping) {
  // Handle conversion if defined in mapping.
  if(value === null && modelColumnMapping.conversion && modelColumnMapping.conversion.hasOwnProperty('#null')) {
    return modelColumnMapping.conversion['#null'];
  }
  else if (value && modelColumnMapping.conversion) {
    if(modelColumnMapping.conversion.hasOwnProperty(value)) {
      return modelColumnMapping.conversion[value];
    }
    else if(modelColumnMapping.conversion.hasOwnProperty('#default')) {
      return modelColumnMapping.conversion['#default'];
    }
  }
  return value;
}

RecordImporter.prototype.putEncounter = function (encounter) {
  var _this = this;
  // Create our own service so we can handle the errors on our own.
  var serviceConfig = _.clone(this.serviceConfig);
  delete serviceConfig.rejectServiceError;

  var encounterService = new graphium.EncounterService(serviceConfig);
  var encounterAction;
  var encounterPatchPromise;

  if(_this.importConfig.encounterSearchQuery) {
    console.log('Using encounterSearchQuery to retrieve encounter ID.');

    let replacements = _this.importConfig.encounterSearchQuery.replacements || {};
    replacements.encounterId = encounter.encounterId;
    replacements.encounterNumber = encounter.encounterNumber;
    replacements.facilityId = encounter.facilityId;

    encounterPatchPromise = this.executeQueryForFirstRow(_this.importConfig.encounterSearchQuery.query, replacements)
    .then(function(result) {
      if(result && !Number.isNaN(parseInt(result.encounterId))) {
        console.log('- Found encounter (' + result.encounterId + '), patching with latest demographics.');
        encounterAction = 'PATCH';
        return encounterService.patchEncounter(parseInt(result.encounterId), encounter);
      }
      else {
        console.log('- Unable to find encounterId via query, creating encounter');
        console.log(encounter);
        encounterAction = 'CREATE';
        return encounterService.createEncounter(encounter);
      }
    });
  }
  else {
    console.log('Using encounter mapping for encounter search: retrieving encounter for encounter number: '+encounter.encounterNumber);
    encounterPatchPromise = encounterService.getEncounterIdByEncounterNumber(encounter.facilityId, encounter.encounterNumber)
    .then(function (getEncounterResult) {
      if (getEncounterResult.hasError && getEncounterResult.errorText.indexOf('Unable to find encounter') >= 0) {

        if(_this.importConfig.abortIfEncounterNotFound) {
          console.log('Unable to find existing encounter, skipping record.');
          return Promise.reject(new Error('Skipping record, existing encounter not found.'));
        }

        console.log('Unable to find encounter, creating encounter.');
        console.log(encounter);
        encounterAction = 'CREATE';
        return encounterService.createEncounter(encounter);
      }
      else if( getEncounterResult.hasError ) {
        console.log('Unable to retrieve encounter, service error: ' + getEncounterResult.errorText);
        return Promise.reject(new Error('Service error trying to perform import.'));
      }
      else {
        console.log('Found encounter, patching with latest demographics.');
        encounterAction = 'PATCH';
        return encounterService.patchEncounter(getEncounterResult.result, encounter);
      }
    });
  }

  return encounterPatchPromise.then(function (createOrPutEncounterResult) {
    if (!createOrPutEncounterResult.hasError) {
      _this.results.encounter = createOrPutEncounterResult.result;
      _this.results.events.push({type:'ENCOUNTER_'+encounterAction,encounterId:createOrPutEncounterResult.result.encounterId});

      console.log('Completed create/patch of encounter.');
      return Promise.resolve(createOrPutEncounterResult.result);
    }
    else {
      console.log('Unable to patch/create encounter.');
      return Promise.reject(new Error('Unable to create/update encounter: ' + createOrPutEncounterResult.errorText));
    }
  });
}

// Credit to https://github.com/sfarthin/intercept-stdout Modified to allow for turning off
// redirecting to stdout once intercepted.
RecordImporter.prototype.interceptConsole = function(stdoutIntercept, stderrIntercept) {
    var _this = this;
    stderrIntercept = stderrIntercept || stdoutIntercept;

    var old_stdout_write = process.stdout.write;
    var old_stderr_write = process.stderr.write;

    process.stdout.write = (function(write) {
      return function(string, encoding, fd) {
        var args = _.toArray(arguments);
        args[0] = interceptor( string, stdoutIntercept );
        if(!_this.hideConsoleOutput)
          write.apply(process.stdout, args);
      };
    }(process.stdout.write));

    process.stderr.write = (function(write) {
      return function(string, encoding, fd) {
        var args = _.toArray(arguments);
        args[0] = interceptor( string, stderrIntercept );
        if(!_this.hideConsoleOutput)
          write.apply(process.stderr, args);
      };
    }(process.stderr.write));

    function interceptor(string, callback) {
      // only intercept the string
      var result = callback(string);
      if (typeof result == 'string') {
        string = result.replace( /\n$/ , '' ) + (result && (/\n$/).test( string ) ? '\n' : '');
      }
      return string;
    }

    // puts back to original
    return function unhook() {
      process.stdout.write = old_stdout_write;
      process.stderr.write = old_stderr_write;
    };
}

RecordImporter.prototype.importRecord = function () {
  var intercept = require('intercept-stdout');
  var capturedLogs = "";
  var unhookIntercept = this.interceptConsole(function(txt) {
    capturedLogs += txt;
  });

  return this._importRecord()
  .then(function(results) {
    results.logs = capturedLogs;
    return Promise.resolve(results);
  })
  .finally(function() {
    unhookIntercept();
  });
}

RecordImporter.prototype.tagForm = function(encounterForm, formTagName, formTagCategory) {
  var _this = this;

  if(formTagName && formTagCategory) {
    console.log('Import config specifies form tag, tagging form.');
    return _this.serviceUtils.tagService.getTags()
    .then(function(tagsResult) {

      var matchingTag = _.find(tagsResult.result, {tagName:formTagName, categoryName:formTagCategory});
      var existingTag = _.find(encounterForm.formTags, function(formTag) { return formTag.tag.tagId == matchingTag.tagId; });

      if(existingTag) {
        console.log('Form is already tagged, skipping tagging.');
        return Promise.resolve();
      }
      else if(!matchingTag) {
        console.log('Cannot find a tag defined with the specified name and category.');
        return Promise.reject(new Error('Cannot find a tag defined with the specified name and category: ' + formTagName + ', ' + formTagCategory));
      }
      else {
        console.log('Tagging encounter form.');
        return _this.serviceUtils.tagService.addTagToForm(encounterForm.encounterFormId, matchingTag.tagId);
      }
    });
  }
  else {
    console.log('Skipping form tagging, no tag specified in config.');
    return Promise.resolve();
  }
}

RecordImporter.prototype._importRecord = function () {
  var _this = this;
  this.results = {
    error: null,
    mappings: [],
    validation: {},
    encounterFormId: null,
    encounterId: null,
    events: []
  };

  console.log(`\n\n----\nBegin processing record...`);

  this.serviceConfig = {
    orgInternalName: this.calculateOrgInternalName(),
    username: this.importConfig.graphiumServiceUser,
    password: this.importConfig.graphiumServicePass,
    baseServiceUrl: this.importConfig.graphiumServiceUrl || "https://service.graphiumemr.com/emr/rest/",
    enableDiskCaching: this.importConfig.enableDiskCaching,
    rejectServiceError: true
  };

  this.serviceUtils = new GraphiumServiceUtils(this.serviceConfig);
  if(!this.serviceConfig.orgInternalName) {
    _this.results.error = new Error('Unable to calculate org internal name, aborting import.');
    return Promise.resolve(_this.results);
  }


  try {
    var generatedEncounter = this.generateEncounterFromRecord(this.record);
  }
  catch(error) {
    error.message = 'Unable to generate encounter: ' + error.message;
    _this.results.error = error;
    console.log(error.message);
    return Promise.resolve(_this.results);
  }

  var persistedEncounter;
  var encounterForm;
  var modelDefinition;
  var percentComplete;

  var skipFormError = new Error('Skipping form creation as directed by configuration.');
  _this.results.encounter = generatedEncounter;
  var formYear = null;
  var originalFormPercentComplete = null;

  return this.putEncounter(generatedEncounter)
    .then(function (persistedEncounterResult) {
      persistedEncounter = persistedEncounterResult;
      _this.results.encounterId = persistedEncounterResult.encounterId;
      _this.results.facilityId = persistedEncounterResult.facilityId;
      _this.results.encounterNumber = persistedEncounterResult.encounterNumber;

      if(_this.importConfig.skipEncounterFormCreateOrUpdate) {
        return Promise.reject(skipFormError);
      }

      return _this.findOrCreateForm(persistedEncounter, _this.record);
    })
    .then(function (encounterFormResult) {
      _this.results.encounterFormId = encounterFormResult.encounterFormId;
      originalFormPercentComplete = encounterFormResult.percentComplete;
      return _this.serviceUtils.parseFormDefinitionContent(encounterFormResult);
    })
    .then(function (encounterFormWithParsedFormDefinition) {
      encounterForm = encounterFormWithParsedFormDefinition;
      var modelDefinitionName = encounterForm.formDef.parsedFormDefinition.form.$.modelName;
      return _this.serviceUtils.getCachedModelDefinition(modelDefinitionName);
    })
    .then(function (modelDefinitionResult) {
      modelDefinition = modelDefinitionResult;
      return _this.executeMappings(persistedEncounter, encounterForm, modelDefinition, _this.record);
    })
    .then(function (mappingResults) {
      var updates = _.flatMap(mappingResults, 'updates');

      var importResult = _.defaults(_this.importConfig.importResult, { importedAt: Date.now() });
      if(_this.importConfig.includeDataInResults) {
        importResult.sourceData = _this.record;
      }

      updates.push({
        propertyName: 'import_result',
        fieldValue: JSON.stringify(importResult),
        percentComplete: 0,
        formValid: false
      });
      //console.log(' - Setting import result: ' + JSON.stringify(importResult));

      var validation = _.transform(mappingResults, function(accumulator, result) {
        accumulator.errorCount += result.hasError === true;
        accumulator.validCount += result.valid === true;
        accumulator.total++;
        accumulator.percentComplete = accumulator.validCount / accumulator.total;
      }, {validCount:0,total:0,errorCount:0});

      var percentComplete = _this.importConfig.hasOwnProperty('formPercentageComplete') && _.isNumber(_this.importConfig.formPercentageComplete) ?
        _this.importConfig.formPercentageComplete :
        validation.percentComplete;

      if(_this.importConfig.hasOwnProperty('skipFormPercentCompleteUpdate') && _this.importConfig.skipFormPercentCompleteUpdate === true) {
        percentComplete = originalFormPercentComplete;
      }

      // Update the percentComplete in the modelPropertyUpdate
      _.forEach(updates, function(update) {
        update.percentComplete = percentComplete, update.formValid = percentComplete == 1
      });

      _this.results.validation = validation;
      _this.results.mappings = mappingResults;

      if(validation.errorCount > 0) {
        console.log('Warning, some mappings failed and need to be reviewed:');
        _.forEach(mappingResults, function(mappingResult) {
          if(mappingResult.hasError) console.log(' - ['+mappingResult.mappingName+'] ' + mappingResult.error.message)
        });
      }

      //console.log('Updating form properties:');
      //_.forEach(updates, function(update) {
      //  console.log(' - Update: ' + update.propertyName + (update.propertySequence ? '['+update.propertySequence+']':'') + ' => ' + update.fieldValue);
      //})

      return _this.serviceUtils.formService.updateEncounterFormModel(encounterForm.encounterFormId, updates);
      //}
    })
    .then(function(updateEncounterFormModelResult) {
      console.log(`Completed updating form (Percent Complete: ${Math.floor(_this.results.validation.percentComplete*100)}, Mapping Errors: ${_this.results.validation.errorCount})`);
      console.log(`Encounter ID: ${_this.results.encounterId} Form ID: ${_this.results.encounterFormId}`);
      _this.results.events.push({type:'ENCOUNTERFORM_UPDATE',encounterId:_this.results.encounterId,encounterFormId:_this.results.encounterFormId,updatedFormVersion:updateEncounterFormModelResult.result});

      if(!_this.importConfig.calculatePqrs && !_this.importConfig.calculateQcdr) {
        return Promise.resolve(null);
      }
      else {
        var dosColumnMappingName = _this.importConfig.dosColumnMappingName;
        if(!dosColumnMappingName) {
          return Promise.reject(new Error('Unable to calculate QCDR results, dosColumnMappingName not specified in import config.'));
        }

        var dosMappingResult = _.find(_this.results.mappings, function(mappingResult) { return mappingResult.mappingName == dosColumnMappingName; });
        if(!dosMappingResult || !dosMappingResult.convertedValue) {
          return Promise.reject(new Error('Unable to calculate QCDR results, unable to find value for date of service column mapping.'));
        }

        var year = dosMappingResult.convertedValue.substr(0,4);
        formYear = year;
        if(year == "2016") {
          var pqrsEval = new EncounterFormPqrsEval(_this.serviceConfig,persistedEncounter.facilityId,encounterForm.encounterFormId);
          return pqrsEval.evaluateForm(true);
        }
        else if(year == "2017") {
          var qcdr2017Eval = new EncounterFormMacraEval2017(_this.serviceConfig,persistedEncounter.facilityId,encounterForm.encounterFormId);
          return qcdr2017Eval.evaluateForm(true);
        }
        else if(year == "2018") {
          var qcdr2018Eval = new EncounterFormMacraEval2018(_this.serviceConfig,persistedEncounter.facilityId,encounterForm.encounterFormId);
          return qcdr2018Eval.evaluateForm(true);
        }
        else if(year == "2019") {
          var qcdr2019Eval = new EncounterFormMacraEval2019(_this.serviceConfig,persistedEncounter.facilityId);
          return qcdr2019Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else if(year == "2020") {
          var qcdr2020Eval = new EncounterFormMacraEval2020(_this.serviceConfig,persistedEncounter.facilityId);
          return qcdr2020Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else if(year == "2021") {
          var qcdr2021Eval = new EncounterFormMacraEval2021(_this.serviceConfig,persistedEncounter.facilityId);
          return qcdr2021Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else if(year == "2022") {
            var qcdr2022Eval = new EncounterFormMacraEval2022(_this.serviceConfig,persistedEncounter.facilityId);
            return qcdr2022Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else if(year == "2023") {
            var qcdr2023Eval = new EncounterFormMacraEval2023(_this.serviceConfig,persistedEncounter.facilityId);
            return qcdr2023Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else if(year == "2024") {
            var qcdr2024Eval = new EncounterFormMacraEval2024(_this.serviceConfig,persistedEncounter.facilityId);
            return qcdr2024Eval.evaluateForm(encounterForm.encounterFormId, true);
        }
        else {
          return Promise.reject(new Error("QCDR evaluation logic for the " + year + " year unavailable."));
        }
      }
    })
    .then(function(qcdrEvalResults) {
      if(!_this.importConfig.calculatePqrs && !_this.importConfig.calculateQcdr) {
        console.log('Skipping PQRS/QCDR evaluation.');
        return Promise.resolve();
      }

      if(_this.importConfig.calculateQcdr) {
        _this.results.qcdrEvalResults = qcdrEvalResults;
      }
      else {
        _this.results.pqrsEvalResults = qcdrEvalResults;
      }

      if(qcdrEvalResults.hasError) {
        console.log('Unable to calculate PQRS/QCDR results: ' + qcdrEvalResults.errorText);
        return Promise.resolve();
      }
      else {
        console.log('Calculated PQRS/QCDR results. Saving to form.');
        let modelUpdates = parseInt(formYear) >= 2019 ? qcdrEvalResults.results[0].modelUpdates : qcdrEvalResults.modelUpdates;
        return _this.serviceUtils.formService.updateEncounterFormModel(encounterForm.encounterFormId, modelUpdates);
      }
    })
    .then(function() {
      return _this.tagForm(encounterForm, _this.importConfig.formTagName, _this.importConfig.formTagCategory);
    })
    .then(function(tagResult) {
      return Promise.resolve(_this.results);
    })
    .catch(function (error) {
      if(error == skipFormError) {
        return Promise.resolve(_this.results);
      }
      else {
        _this.results.error = error;
        console.log('Aborting record import - ' + error.message);
        console.log(error.stack);
        if(error.result && error.result.hasError)
          console.log('- Service error: ' + error.result.errorText);
        return Promise.resolve(_this.results);
      }
    })
}

function safeExtractTime(dateTimeString) {
  if (!dateTimeString)
    return null;

  var matchesTimeString = dateTimeString.match(/(\d{2}:\d{2}:\d{2})/g);
  if (matchesTimeString)
    return matchesTimeString[0];

  var matchesNumber = dateTimeString.match(/^([0-2]?[0-9]?[0-5]?[0-9]?)$/);
  if (matchesNumber)
    dateTimeString = _.padStart(dateTimeString, 4, '0');

  var matches24HrTime = dateTimeString.match(/^([01]\d|2[0-3]):?([0-5]\d)$/);
  if (matches24HrTime)
    return [matches24HrTime[1], matches24HrTime[2], '00'].join(':');

  return null;
}

function correctCommonYearErrors(yearString) {
  if(yearString && _.isString(yearString)) {
    if(_.startsWith(yearString, '02'))
      return '20'+yearString.substr(2);
    else if(_.startsWith(yearString, '91'))
      return '19'+yearString.substr(2);
  }
  return yearString;
}


function parseTwoDigitYearThisYearOrEarlier(input) {
	var currentTwoDigitYear = parseInt(new Date().getFullYear().toString().substr(2,2));

	var fullYear = "20" + input;
	if( input > currentTwoDigitYear )
		fullYear = "19" + input;

	return fullYear;
}

function safeExtractDate(dateTimeString, sourceDateTimeFormat) {
  if (!dateTimeString)
    return null;

	moment.parseTwoDigitYear = parseTwoDigitYearThisYearOrEarlier;

  var defaultDateFormats = ['MM-DD-YYYY','M/D/YY','MM/DD/YYYY','MM-DD-YY','M-D-YYYY','M-D-YY','YYYY-MM-DD'];
  var dateParsingFormats = sourceDateTimeFormat ? [sourceDateTimeFormat] : defaultDateFormats;
  var strictParsing = sourceDateTimeFormat != null;
  console.log('  - Parsing date with the following formats: ' + JSON.stringify(dateParsingFormats));
  console.log('  - Strictly parsing date: ' + strictParsing);
  var mdate = moment(dateTimeString, dateParsingFormats, strictParsing);
  if (mdate.isValid()) {
    var parsedDateString = correctCommonYearErrors(mdate.format('YYYY-MM-DD'));

    // Also make sure the date is within a reasonable date (ie. in the 1900s or 2000s)
    var range = moment.range(new Date(1900,1,1), moment().add(1,'y'));

    if(range.contains(moment(parsedDateString,'YYYY-MM-DD'))) {
      console.log('  - Parsed date (original, parsed): ('+dateTimeString+', '+parsedDateString+')');
      return parsedDateString;
    }
    else {
      console.log('  - Unable to convert date, appears to be outside reasonable range (original,parsed): ('+dateTimeString+', '+parsedDateString+')');
      return null;
    }
  }
  else {
    // Give up.
    console.log('  - Unable to parse date from string: ' + dateTimeString);
    return null;
  }
}

module.exports = RecordImporter;