var _ = require("lodash");
var graphium = require("@graphiumhealth/graphium-sdk");
import { GraphiumServiceUtils } from "./GraphiumServiceUtils";
var Promise = require("bluebird");
var EncounterFormPqrsEval = require("./EncounterFormPqrsEval.js");
var EncounterFormMacraEval2017 = require("./EncounterFormMacraEval2017");

var moment = require("moment");
require("moment-range");

interface ValueFormatter {
    regex?: string;
    expression?: {
        (input: string | number | boolean): string | number | boolean;
    };
    // Can be #default which will be the default
    // value if no key found for conversion.
    conversion?: { [s: string]: any };
}

interface OrgInternalNameMapping extends ValueFormatter {
    columnName: string;
}

interface SplitMapping extends ValueFormatter {
    mappingType: "split";
    delimiter: string;
    trim?: boolean;
    byIndex?: Array<{
        index: number;
        mapping:
            | DefaultMapping
            | ProviderMapping
            | DateTimeMapping
            | SplitMapping
            | BooleanMultiSelectGroupMapping;
    }>;
    forEach?:
        | DefaultMapping
        | ProviderMapping
        | DateTimeMapping
        | SplitMapping
        | BooleanMultiSelectGroupMapping;
}

interface DefaultMapping extends ValueFormatter {
    modelProperty: string;
    conversion: { [s: string]: string | number | boolean };
}

interface CoalesceMapping extends ValueFormatter {}

interface ModelMapSelectGroupMapping {}

interface ProviderMapping extends ValueFormatter {
    mappingType: "provider";
    lookupType: "npi";
    validate: "notNull";
    providerType?: "surgeon" | "mda" | "crna";
    providerIdModelProperty: string;
    providerIdSequenceNumber: number | "#index";
    providerTypeModelProperty: string;
    providerTypeSequenceNumber: number | "#index";
    providerNameModelProperty: string;
    providerNameSequenceNumber: number | "#index";
}

interface BooleanMultiSelectGroupMapping extends ValueFormatter {
    mappingType: "booleanMultiSelectGroup";
    delimiter: string;
    modelPropertyConversion: { [s: string]: string };
}

interface DateTimeMapping extends ValueFormatter {
    modelProperty: string;
    sourceDateTimeFormat?: string;
    validate: "notNull";
}

interface EncounterMapping extends ValueFormatter {
    columnName: string;
    dataType?: "date" | "time";
    sourceDateTimeFormat?: string;
}

interface FormSearchMatchingCriteria extends ValueFormatter {
    columnName: string;
    sourceDateTimeFormat?: string;
    searchParameterType?: "date" | "time";
}

interface RecordImporterConfig {
    orgInternalNameMapping?: OrgInternalNameMapping;
    orgInternalName?: string;
    facilityId: number;
    importResult?: {
        importBatchGuid: string;
        importBatchRecordGuid: string;
        recordIndex: number;
    };
    graphiumServiceUser: string;
    graphiumServicePass: string;
    graphiumServiceUrl: string;
    enableDiskCaching?: boolean;
    formSearchName: string;
    formDefinitionName: string;
    calculatePqrs?: boolean;
    calculateQcdr?: boolean;
    dosColumnMappingName?: string;
    pageName: string;
    encounterMapping:
        | {
              [s: string]: EncounterMapping;
          }
        | Array<{
              [s: string]: EncounterMapping;
          }>;
    formSearchMatchingCriteria:
        | {
              [s: string]: FormSearchMatchingCriteria;
          }
        | Array<{
              [s: string]: FormSearchMatchingCriteria;
          }>;
    modelColumnMapping: {
        [s: string]:
            | DefaultMapping
            | ProviderMapping
            | DateTimeMapping
            | SplitMapping
            | BooleanMultiSelectGroupMapping;
    } & {
        skipIfNotSet?: boolean;
    };
}

export class RecordImporterV2 {
    private facilityProviders: any[];
    private serviceConfig: any;
    private results: any;
    private serviceUtils: GraphiumServiceUtils;
    private targetFormDefinition: any;

    constructor(
        readonly importConfig: RecordImporterConfig,
        readonly record: { [s: string]: string | number | boolean },
        readonly hideConsoleOutput: boolean
    ) {
        this.importConfig = importConfig;
        this.validateConfig();

        this.record = record;
        this.facilityProviders = [];
        this.hideConsoleOutput = hideConsoleOutput;
    }

    private calculateOrgInternalName(): string {
        console.log(" - Calculating org internal name.");
        var hasExplicitOrgInternalName =
            this.importConfig.orgInternalName != null;
        var hasOrgInternalNameMapping =
            this.importConfig.orgInternalNameMapping != null;
        console.log(
            "  - Has explicit org internal name: " + hasExplicitOrgInternalName
        );
        console.log(
            "  - Has org internal name mapping: " + hasOrgInternalNameMapping
        );

        var explicitOrgInternalName = null;
        var mappingOrgInternalName = null;

        if (hasExplicitOrgInternalName) {
            explicitOrgInternalName = this.importConfig.orgInternalName;
        }
        if (hasOrgInternalNameMapping) {
            mappingOrgInternalName = this._executeOrgInternalNameMapping(
                this.record,
                this.importConfig.orgInternalNameMapping
            );
        }

        if (hasExplicitOrgInternalName && hasOrgInternalNameMapping) {
            // If both the mappign and explicit are defined, we just check to see if they match,
            // otherwise we return null.
            if (explicitOrgInternalName == mappingOrgInternalName) {
                return explicitOrgInternalName;
            } else {
                console.log(
                    "  - ERROR: mapping org name and explicit org name do not match!"
                );
                return null;
            }
        } else {
            // If only one or the other is defined, we default to the explicit org name. Otherwise we return
            // whatever the mapping returned, which could be null or undefined.
            if (explicitOrgInternalName) {
                return explicitOrgInternalName;
            } else {
                return mappingOrgInternalName;
            }
        }
    }

    _executeOrgInternalNameMapping(record, mapping) {
        var value = this.getRecordValue(record, mapping.columnName);

        if (value == null || value === "") {
            return null;
        }

        var formattedValue = value;
        formattedValue = this._applyMappingRegex(formattedValue, mapping);
        formattedValue = this._applyMappingExpression(formattedValue, mapping);
        formattedValue = this._applyMappingConversion(formattedValue, mapping);

        return formattedValue;
    }

    validateConfig() {
        if (!this.importConfig.pageName)
            throw new Error("Config does not specify pageName.");
        if (!this.importConfig.formSearchName)
            throw new Error("Config does not specify formSearchName.");
        if (
            !this.importConfig.orgInternalName &&
            !this.importConfig.orgInternalNameMapping
        )
            throw new Error(
                "Config does not specify orgInternalName explicitly or in a mapping."
            );
        if (!this.importConfig.formDefinitionName)
            throw new Error("Config does not specify formDefinitionName.");
        if (!this.importConfig.graphiumServiceUser)
            throw new Error("Config does not specify graphiumServiceUser.");
        if (!this.importConfig.graphiumServiceUser)
            throw new Error("Config does not specify graphiumServicePass.");
        if (!this.importConfig.encounterMapping)
            throw new Error(
                "Import config must specify an encounterMapping element."
            );
        if (
            !this.importConfig.encounterMapping.hasOwnProperty(
                "encounterNumber"
            )
        )
            throw new Error(
                "Import config encounterMapping must specify an encounterNumber mapping."
            );
        if (!this.importConfig.formSearchMatchingCriteria)
            throw new Error(
                "Import config must specify a formSearchMatchingCriteria element."
            );
    }

    validateMappings(mappings) {
        // TODO
    }

    _generateSearchParametersAndUpdates(
        encounter,
        record,
        useOldDatesForSearch
    ) {
        var searchParameters = [];
        var updatesForFormCreation = [];

        searchParameters.push({
            parameterName: "fac_id",
            parameterValue: parseInt(encounter.facilityId)
        });
        searchParameters.push({
            parameterName: "form_defn_nm",
            parameterValue: this.importConfig.formDefinitionName
        });
        searchParameters.push({
            parameterName: "enctr_enctr_no",
            parameterValue: encounter.encounterNumber
        });

        // tslint:disable-next-line:forin
        for (var matchingCriteriaName in this.importConfig
            .formSearchMatchingCriteria) {
            var matchingCriteriaArray = this.importConfig
                .formSearchMatchingCriteria[matchingCriteriaName];
            if (!_.isArray(matchingCriteriaArray)) {
                matchingCriteriaArray = [matchingCriteriaArray];
            }

            var createdCriteriaForNotNullValue;
            _.forEach(matchingCriteriaArray, function(matchingCriteria) {
                console.log(
                    "Generating search criteria: " + matchingCriteria.columnName
                );

                var value = this.getRecordValue(
                    record,
                    matchingCriteria.columnName
                );
                var modelValue = value;

                console.log("  -- Unformatted value: " + modelValue);
                modelValue = this._applyMappingRegex(
                    modelValue,
                    matchingCriteria
                );
                console.log("  -- After applying regex: " + modelValue);
                modelValue = this._applyMappingExpression(
                    modelValue,
                    matchingCriteria
                );
                console.log("  -- After applying expression: " + modelValue);
                modelValue = this._applyMappingConversion(
                    modelValue,
                    matchingCriteria
                );
                console.log("  -- After applying conversion: " + modelValue);

                if (!value || value == "" || createdCriteriaForNotNullValue) {
                    return;
                    //console.error(`Unable to generate matching criteria for form search, criteria (${matchingCriteriaName}) does not contain a value.`);
                    //throw new Error(`Unable to generate matching criteria for form search, criteria (${matchingCriteriaName}) does not contain a value.`);
                }

                createdCriteriaForNotNullValue = true;

                if (matchingCriteria.searchParameterType == "date") {
                    if (useOldDatesForSearch) {
                        console.log(
                            "  -- Applying old date logic to: " + modelValue
                        );
                        var date = moment(new Date(modelValue));
                        if (date.isValid()) {
                            console.log(
                                "    -- Date is valid: " + date.toString()
                            );
                            value = {
                                lowerBounds: date.format("YYYY-MM-DD"),
                                upperBounds: date.format("YYYY-MM-DD")
                            };
                            modelValue =
                                date.format("YYYY-MM-DD") + "T00:00:00.0Z";
                            console.log(
                                "    -- Formatted date to: " + modelValue
                            );
                        } else {
                            //console.error('Unable to generate matching criteria for form search, invalid date.');
                            throw new Error(
                                "Attempting to parse invalid date for matching criteria."
                            );
                        }
                    } else {
                        console.log(
                            "  -- Applying updated date logic to: " + modelValue
                        );
                        console.log(
                            "    -- Extracting date, using sourceDateTimeFormat: " +
                                matchingCriteria.sourceDateTimeFormat
                        );
                        var extractedDate = this.safeExtractDate(
                            modelValue,
                            matchingCriteria.sourceDateTimeFormat
                        );
                        if (!extractedDate) {
                            console.log("    -- Unable to extract date.");
                            throw new Error(
                                "Unable to extract date for form search."
                            );
                        } else {
                            console.log("    -- Extracted date: " + extractedDate);
                            value = {
                                lowerBounds: extractedDate,
                                upperBounds: extractedDate
                            };
                            modelValue = extractedDate;
                        }
                    }
                } else if (matchingCriteria.searchParameterType == "time") {
                    var time = this.safeExtractTime(value.toString());
                    if (time != null) {
                        value = {
                            lowerBounds: time,
                            upperBounds: time
                        };
                        modelValue = "1900-01-01T" + time + "Z";
                    } else {
                        console.log(
                            "Unable to generate matching criteria for form search, invalid time."
                        );
                        throw new Error(
                            "Unable to generate matching criteria for form search, invalid time."
                        );
                    }
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

            if (!createdCriteriaForNotNullValue)
                throw new Error(
                    `Unable to generate matching criteria for form search, no criteria for (${matchingCriteriaName}) contained a value.`
                );
        }

        return {
            searchParameters: searchParameters,
            updatesForFormCreation: updatesForFormCreation
        };
    }

    findExistingForm(encounter, record, generatedParametersAndUpdates) {
        console.log("Searching for existing form using matching criteria.");

        console.log("- Searching using criteria: ");
        _.forEach(generatedParametersAndUpdates.searchParameters, function(
            parameter
        ) {
            console.log(
                " - " +
                    parameter.parameterName +
                    ": " +
                    JSON.stringify(parameter.parameterValue)
            );
        });
        this.results.generatedPrimaryFormSearchParametersAndUpdates = generatedParametersAndUpdates;

        return this.serviceUtils
            .getSearchResultsBySearchName(
                this.importConfig.formSearchName,
                generatedParametersAndUpdates.searchParameters
            )
            .then(function(searchResults) {
                if (!searchResults || searchResults.length == 0) {
                    // If the search with the old dates doesn't return a form, try with the current date formats.'
                    generatedParametersAndUpdates = this._generateSearchParametersAndUpdates(
                        encounter,
                        record,
                        false
                    );
                    this.results.generatedSecondaryFormSearchParametersAndUpdates = generatedParametersAndUpdates;
                    console.log("- Searching again using criteria: ");
                    _.forEach(
                        generatedParametersAndUpdates.searchParameters,
                        function(parameter) {
                            console.log(
                                " - " +
                                    parameter.parameterName +
                                    ": " +
                                    JSON.stringify(parameter.parameterValue)
                            );
                        }
                    );
                    return this.serviceUtils.getSearchResultsBySearchName(
                        this.importConfig.formSearchName,
                        generatedParametersAndUpdates.searchParameters
                    );
                } else {
                    return Promise.resolve(searchResults);
                }
            })
            .then(function(searchResults) {
                if (searchResults.length == 0) {
                    console.log("- No forms found matching the criteria.");
                    return Promise.resolve(null);
                } else if (searchResults.length == 1) {
                    console.log(
                        "- Found form using matching criteria, encounterFormId: " +
                            searchResults[0].enctr_form_id
                    );
                    return Promise.resolve(searchResults[0].enctr_form_id);
                } else {
                    console.log(
                        "Unable to identify matching form, found multiple forms that meet the matching criteria."
                    );
                    return Promise.reject(
                        new Error(
                            "Found multiple forms that meet the matching criteria, please fix the forms in this encounter."
                        )
                    );
                }
            });
    }

    findOrCreateForm(encounter, record) {
        var encounterForm;
        var formAction;

        var generatedParametersAndUpdates = this._generateSearchParametersAndUpdates(
            encounter,
            record,
            true
        );

        return this.findExistingForm(
            encounter,
            record,
            generatedParametersAndUpdates
        )
            .then(function(encounterFormId) {
                if (encounterFormId === null) {
                    console.log(
                        "Unable to find form using criteria, creating encounter form."
                    );
                    formAction = "createForm";
                    if (this.importConfig.abortIfFormNotFound) {
                        return Promise.reject(
                            new Error(
                                "Skipping record, existing form not found."
                            )
                        );
                    }

                    return this.serviceUtils
                        .createEncounterForm(
                            encounter.facilityId,
                            encounter.encounterId,
                            this.importConfig.formDefinitionName
                        )
                        .then(function(createEncounterFormResult) {
                            console.log(
                                "Form created, encounterFormId: " +
                                    createEncounterFormResult.result
                                        .encounterFormId
                            );
                            this.results.events.push({
                                type: "ENCOUNTERFORM_CREATE",
                                encounterFormId:
                                    createEncounterFormResult.result
                                        .encounterFormId
                            });
                            return Promise.resolve(
                                createEncounterFormResult.result.encounterFormId
                            );
                        })
                        .catch(function(error) {
                            console.log(
                                "Unable to create form: " + error.message
                            );
                            return Promise.reject(error);
                        });
                } else {
                    console.log(
                        "Found form using matching criteria, encounterFormId: " +
                            encounterFormId
                    );
                    formAction = "none";
                    return Promise.resolve(encounterFormId);
                }
            })
            .then(function(encounterFormId) {
                if (formAction == "createForm") {
                    console.log(
                        "Updating form to match search criteria so we don't create it again."
                    );
                    // Yeah we nest the promise so that we can return the same encounterFormId to the next then. I hate promises.
                    return this.serviceUtils.formService
                        .updateEncounterFormModel(
                            encounterFormId,
                            generatedParametersAndUpdates.updatesForFormCreation
                        )
                        .then(function(formUpdateVersion) {
                            this.results.events.push({
                                type: "ENCOUNTERFORM_UPDATE",
                                encounterId: encounter.encounterId,
                                encounterFormId: encounterFormId,
                                updatedFormVersion: formUpdateVersion.result
                            });
                            return Promise.resolve(encounterFormId);
                        });
                } else {
                    return Promise.resolve(encounterFormId);
                }
            })
            .then(function(encounterFormId) {
                console.log("Loading encounter form with pages and data.");
                return this.serviceUtils.formService.getEncounterFormById(
                    encounterFormId,
                    false,
                    true
                );
            })
            .then(function(encounterFormResult) {
                console.log("Getting form definition with content.");
                encounterForm = encounterFormResult.result;
                return this.serviceUtils.getCachedFormDefinitionWithContent(
                    encounterForm.formDef.formDefinitionId,
                    encounterForm.formDef.formDefinitionVersion
                );
            })
            .then(function(formDefinitionWithContentResult) {
                console.log(
                    "Completed loading encounter form and form definition."
                );
                encounterForm.formDef = formDefinitionWithContentResult;
                return Promise.resolve(encounterForm);
            });
    }

    createForm(encounter) {
        var encounterForm = {
            encounterId: encounter.encounterId,
            formDefinitionId: this.targetFormDefinition.formDefinitionId,
            formDefinitionVersion: this.targetFormDefinition
                .formDefinitionVersion
        };
    }

    _generateEncounterMappingValue(record, encounterMapping) {
        var value;

        if (encounterMapping.hasOwnProperty("value")) {
            value = encounterMapping.value;
        } else {
            value = this.getRecordValue(record, encounterMapping.columnName);
        }

        if (value == null || value === "") {
            return null;
        }

        var formattedValue = value;
        formattedValue = this._applyMappingRegex(
            formattedValue,
            encounterMapping
        );
        formattedValue = this._applyMappingExpression(
            formattedValue,
            encounterMapping
        );
        formattedValue = this._applyMappingConversion(
            formattedValue,
            encounterMapping
        );

        if (encounterMapping.dataType == "date") {
            formattedValue = this.safeExtractDate(
                formattedValue,
                encounterMapping.sourceDateTimeFormat
            );
        } else if (encounterMapping.dataType == "int") {
            formattedValue = parseInt(formattedValue);
        }

        return formattedValue;
    }

    generateEncounterFromRecord(record) {
        var encounter: any = {};

        // First default facility ID to the one set in the import config, if set. This is not
        // a required property, and can also be set in a mapping so that it will be generated
        // based on the content of the record. If both are set, the mapping will override this
        // value.
        if (_.isInteger(this.importConfig.facilityId))
            encounter.facilityId = this.importConfig.facilityId;

        console.log("- Executing encounter mappings.");
        // tslint:disable-next-line:forin
        for (var encounterMappingName in this.importConfig.encounterMapping) {
            var encounterMapping = this.importConfig.encounterMapping[
                encounterMappingName
            ];
            var encounterMappingValue = null;

            // If you specify an array of encounter mappings, we will coalesce the mappings
            // and use the first not null mapping.
            if (_.isArray(encounterMapping)) {
                var mappings = encounterMapping.concat();
                while (encounterMappingValue == null && mappings.length > 0) {
                    encounterMappingValue = this._generateEncounterMappingValue(
                        record,
                        mappings.shift()
                    );
                }
            } else {
                // Otherwise you can just specify a single mapping.
                encounterMappingValue = this._generateEncounterMappingValue(
                    record,
                    encounterMapping
                );
            }
            console.log(
                " - Setting encounter property: " +
                    encounterMappingName +
                    " => " +
                    encounterMappingValue
            );
            encounter[encounterMappingName] = encounterMappingValue;
        }

        if (!encounter.encounterNumber)
            throw new Error("encounter number not set in record.");
        if (!encounter.facilityId)
            throw new Error("encounter facility ID not set in record.");

        // Let's replace forward slashes in the encounter number
        // with colon.
        encounter.encounterNumber = encounter.encounterNumber.replace("/", ":");

        return encounter;
    }

    getRecordValue(record, propertyName) {
        if (!propertyName) return null;

        var propertyNameLowercase = propertyName.toLowerCase();
        for (var attr in record) {
            if (attr.toLowerCase() == propertyNameLowercase) {
                var value = record[attr];
                if (value === "") value = null;
                return value;
            }
        }

        return null;
    }

    executeProviderMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        console.log(" - Executing provider mapping for value: " + inputValue);
        var value = inputValue;
        var defaultPageId = this.serviceUtils.getFirstPageIdByName(
            this.importConfig.pageName,
            encounterForm.pages
        );
        var modelUtil = new graphium.ModelUtil(modelDefinition);
        var mappingResult = {
            updates: [],
            valid: true,
            hasError: false,
            error: null,
            originalValue: value,
            convertedValue: undefined
        };

        if (!value) {
            if (modelColumnMapping.validate == "notNull") {
                mappingResult.valid = false;
            }
            return Promise.resolve(mappingResult);
        }

        var getProviderFunction = this.serviceUtils.getProviderByNpi;
        if (modelColumnMapping.lookupType == "providerId") {
            getProviderFunction = this.serviceUtils.getProviderById;
        } else if (modelColumnMapping.lookupType == "lastName") {
            getProviderFunction = this.serviceUtils.getProviderByLastName;
        } else if (modelColumnMapping.lookupType == "lastNameAndFirstName") {
            getProviderFunction = this.serviceUtils.getProviderByLastNameAndFirstName;
        }

        return getProviderFunction
            .call(
                this.serviceUtils,
                encounter.facilityId,
                value,
                modelColumnMapping.providerType
            )
            .then(function(provider) {
                if (!provider) {
                    console.log(
                        " - Provider mapping provider not found for: " + value
                    );
                    mappingResult.hasError = true;
                    mappingResult.error = new Error(
                        `Provider not found for ${JSON.stringify(value)}.`
                    );
                    mappingResult.valid = false;
                    console.log("  - " + mappingResult.error.message);
                    return Promise.resolve([]);
                } else {
                    console.log(
                        " - Provider mapping provider found: " + provider
                    );
                    var updates = [];
                    var name = provider
                        ? provider.lastName.substring(0, 10) +
                          "-" +
                          provider.nationalProviderId.substring(
                              provider.nationalProviderId.length - 5
                          )
                        : null;
                    var providerType = provider ? provider.providerType : null;
                    var providerId = provider ? provider.providerId : null;

                    var providerIdSequenceNumber =
                        modelColumnMapping.providerIdSequenceNumber == "#index"
                            ? index
                            : modelColumnMapping.providerIdSequenceNumber;
                    var providerNameSequenceNumber =
                        modelColumnMapping.providerNameSequenceNumber ==
                        "#index"
                            ? index
                            : modelColumnMapping.providerNameSequenceNumber;
                    var providerTypeSequenceNumber =
                        modelColumnMapping.providerTypeSequenceNumber ==
                        "#index"
                            ? index
                            : modelColumnMapping.providerTypeSequenceNumber;

                    mappingResult.convertedValue =
                        "name:" +
                        name +
                        ", providerType:" +
                        providerType +
                        ", providerId:" +
                        providerId;
                    updates.push(
                        modelUtil.formatModelPropertyUpdate(
                            modelColumnMapping.providerIdModelProperty,
                            providerId,
                            providerIdSequenceNumber,
                            defaultPageId
                        )
                    );
                    updates.push(
                        modelUtil.formatModelPropertyUpdate(
                            modelColumnMapping.providerNameModelProperty,
                            name,
                            providerNameSequenceNumber,
                            defaultPageId
                        )
                    );
                    if (modelColumnMapping.providerType != "surgeon")
                        updates.push(
                            modelUtil.formatModelPropertyUpdate(
                                modelColumnMapping.providerTypeModelProperty,
                                providerType,
                                providerTypeSequenceNumber,
                                defaultPageId
                            )
                        );

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
                console.log(
                    " - Unable to execute provider mapping: " + error.message
                );
                return Promise.resolve(mappingResult);
            });
    }

    splitAndCleanList(list) {
        if (list) {
            return _.map(_.split(list, ","), _.trim);
        }
        return [];
    }

    executeBooleanMultiSelectGroupMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        console.log(
            " - Executing booleanMultiSelectGroup mapping for value: " +
                inputValue
        );
        var value = inputValue;
        var defaultPageId = this.serviceUtils.getFirstPageIdByName(
            this.importConfig.pageName,
            encounterForm.pages
        );
        var modelUtil = new graphium.ModelUtil(modelDefinition);
        var mappingResult = {
            updates: [],
            valid: true,
            hasError: false,
            error: null,
            originalValue: value,
            convertedValue: undefined
        };

        var defaultPageId = this.serviceUtils.getFirstPageIdByName(
            this.importConfig.pageName,
            encounterForm.pages
        );
        var modelUtil = new graphium.ModelUtil(modelDefinition);

        var modelProperties = _.keys(
            modelColumnMapping.modelPropertyConversion
        );
        if (!modelProperties || modelProperties.length == 0) {
            return Promise.resolve(mappingResult);
        }

        var delimiter = modelColumnMapping.delimiter;
        if (delimiter == null) {
            mappingResult.hasError = true;
            mappingResult.error = new Error(
                "Unable to execute mapping, mapping does not specify a delimiter."
            );
            return Promise.resolve(mappingResult);
        }

        var values =
            _.isString(value) && value.length > 0
                ? _.map(value.split(delimiter), function(v) {
                      return v.toLowerCase();
                  })
                : [];
        console.log("  - Selected values: " + JSON.stringify(values));

        // If there are no values in the list, let's just set everything to false.
        mappingResult.updates = [];
        _.forIn(modelColumnMapping.modelPropertyConversion, function(
            modelProperty,
            selectValue
        ) {
            var isSelected = _.includes(values, selectValue.toLowerCase());
            console.log(
                "    - Creating update for " + modelProperty + ": " + isSelected
            );
            mappingResult.updates.push(
                modelUtil.formatModelPropertyUpdate(modelProperty, isSelected)
            );
        });

        return Promise.resolve(mappingResult);
    }

    executeModelMapSelectGroupMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName
    ) {
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
        var selectionIndicatedModelProperty =
            modelColumnMapping.selectionIndicatedModelProperty;
        var defaultPageId = this.serviceUtils.getFirstPageIdByName(
            this.importConfig.pageName,
            encounterForm.pages
        );

        console.log(" - Converting columns to keys.");
        var rawKeys = _.flatten(
            _.map(modelColumnMapping.columns, function(columnName) {
                console.log("   - Converting column: " + columnName);
                if (modelColumnMapping.columnNameAsKey) {
                    console.log("   - Using column name as key.");
                    var value = this.getRecordValue(record, columnName);
                    return modelColumnMapping.columnInclusionIndicator === value
                        ? columnName
                        : null;
                } else {
                    console.log("   - Using column value as key.");
                    var value = this.getRecordValue(record, columnName);
                    if (value && modelColumnMapping.columnDelimiter) {
                        console.log(
                            "   - Found delimiter, splitting column value: " +
                                value
                        );
                        var values = value
                            .toString()
                            .split(modelColumnMapping.columnDelimiter);
                        return values;
                    } else {
                        return value;
                    }
                }
            })
        );
        // Remove any null values or empty keys.
        var keys = _.compact(_.map(rawKeys, _.trim));
        console.log(" - Completed genrating keys: " + JSON.stringify(keys));

        // If a key conversion exists, perform the conversion.
        if (modelColumnMapping.mapKeyConversion) {
            var lowercaseConversion = _.mapKeys(
                modelColumnMapping.mapKeyConversion,
                function(value, key) {
                    return key.toLowerCase();
                }
            );

            keys = _.map(keys, function(key) {
                if (lowercaseConversion.hasOwnProperty(key.toLowerCase()))
                    return lowercaseConversion[key.toLowerCase()];
                return null;
            });

            // Remove any keys where a conversion didn't occur.
            keys = _.compact(keys);
            console.log(" - Converted keys: " + JSON.stringify(keys));
        }

        mappingResult.originalValue = mappingResult.convertedValue = keys.join(
            ","
        );

        var generatedSequenceNumbers = [];
        var sequenceNumbers = _.map(keys, function(modelMapKey) {
            var sn = parseInt(
                this.serviceUtils.getOrGenerateSequenceNumberForProperty(
                    encounterForm,
                    modelMapKeyProperty,
                    modelMapKey,
                    generatedSequenceNumbers
                )
            );
            generatedSequenceNumbers.push(sn);
            return sn;
        });

        var updates = [];
        var modelUtil = new graphium.ModelUtil(modelDefinition);
        _.map(keys, function(key, index, coll) {
            // Add key property.
            updates.push(
                modelUtil.formatModelPropertyUpdate(
                    modelMapKeyProperty,
                    key,
                    sequenceNumbers[index],
                    defaultPageId
                )
            );
            // Add value property to set value to 'true' to indicate that the complication is selected.
            updates.push(
                modelUtil.formatModelPropertyUpdate(
                    modelMapValueProperty,
                    true,
                    sequenceNumbers[index],
                    defaultPageId
                )
            );
        });

        // Now we need to set any complications that are currently selected but not in our
        // spreadsheet to false.
        var existingSequenceNumbers = this.serviceUtils.getAllSequenceNumbersForModelMapKey(
            encounterForm,
            modelMapKeyProperty
        );
        var sequenceNumbersToDeactivate = _.difference(
            existingSequenceNumbers,
            sequenceNumbers
        );
        _.map(sequenceNumbersToDeactivate, function(sequenceNumber) {
            updates.push(
                modelUtil.formatModelPropertyUpdate(
                    modelMapValueProperty,
                    false,
                    sequenceNumber,
                    defaultPageId
                )
            );
        });

        if (selectionIndicatedModelProperty) {
            updates.push(
                modelUtil.formatModelPropertyUpdate(
                    selectionIndicatedModelProperty,
                    keys.length > 0
                )
            );
        }

        mappingResult.updates = updates;
        return Promise.resolve(mappingResult);
    }

    executeDefaultMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        var mappingResult = {
            updates: [],
            valid: true,
            hasError: false,
            error: null,
            originalValue: inputValue,
            convertedValue: undefined
        };

        var modelProperty = modelColumnMapping.modelProperty;
        var hasSequenceNumber = modelColumnMapping.hasOwnProperty(
            "sequenceNumber"
        );
        var sequenceNumber;
        var defaultPageId = this.serviceUtils.getFirstPageIdByName(
            this.importConfig.pageName,
            encounterForm.pages
        );

        var modelUtil = new graphium.ModelUtil(modelDefinition);
        var modelPropertyType = modelUtil.getModelPropertyType(modelProperty);

        if (hasSequenceNumber && defaultPageId === null) {
            mappingResult.valid = false;
            mappingResult.hasError = true;
            mappingResult.error = new Error(
                "Attempting to set model property with sequence number, but page (" +
                    this.importConfig.pageName +
                    ") does not exist."
            );
        }

        if (!modelPropertyType) {
            mappingResult.valid = false;
            mappingResult.hasError = true;
            mappingResult.error = new Error(
                "Unable to generate model property for column mapping, model property (" +
                    modelProperty +
                    ") does not exist."
            );
        }

        // We are doing this to convert from the spreadsheet date/time formats to our own
        // format taht will work with the model property util. We need to expand the model
        // util to support these at some point. TODO
        var value = inputValue;
        switch (modelPropertyType) {
            case "date":
                value = this.safeExtractDate(
                    value,
                    modelColumnMapping.sourceDateTimeFormat
                );
                break;
            case "time":
                value = this.safeExtractTime(value);
                break;
        }

        if (modelColumnMapping.validate == "notNull") {
            mappingResult.valid = value !== null;
        }

        mappingResult.convertedValue = value;
        mappingResult.updates = [
            modelUtil.formatModelPropertyUpdate(
                modelProperty,
                value,
                sequenceNumber,
                defaultPageId
            )
        ];
        return Promise.resolve(mappingResult);
    }

    executeCoalesceMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        var defaultMappingResult = {
            updates: [],
            valid: true,
            hasError: false,
            error: null,
            originalValue: inputValue,
            convertedValue: undefined
        };

        var columnValues = _.compact(
            _.map(modelColumnMapping.columns, function(columnName) {
                console.log("   - Coalescing column: " + columnName);
                var value = this.getRecordValue(record, columnName);
                if (value != null && value != "") return value;
            })
        );

        // If none of the columns have a value, we use null.
        var coalescedValue = columnValues.length == 0 ? null : columnValues[0];
        return this._executeMapping(
            record,
            coalescedValue,
            encounter,
            encounterForm,
            modelDefinition,
            modelColumnMapping.mapping,
            mappingName,
            index
        );
    }

    executeSplitMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        var delimiter = modelColumnMapping.delimiter;
        var trim = modelColumnMapping.hasOwnProperty("trim")
            ? modelColumnMapping.trim == true ||
              modelColumnMapping.trim == "true"
            : true;
        var defaultMappingResult = {
            updates: [],
            valid: true,
            hasError: false,
            error: null,
            originalValue: inputValue,
            convertedValue: undefined
        };

        console.log(" - Executing split mapping.");
        if (!inputValue) {
            console.log(" - Input value empty, skipping mapping.");
            return Promise.resolve(defaultMappingResult);
        }

        var inputValues = inputValue.split(delimiter);
        if (!inputValues || inputValues.length == 0) {
            console.log("Split values are empty, skipping mapping.");
            return Promise.resolve(defaultMappingResult);
        }

        var forEachPromise = Promise.resolve();
        var promiseIndex = -1;
        if (modelColumnMapping.forEach) {
            console.log(" - Found forEach mappings.");
            forEachPromise = Promise.mapSeries(inputValues, function(v) {
                console.log("   - Executing forEach mapping with value: " + v);
                return this._executeMapping(
                    record,
                    _.trim(v),
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping.forEach,
                    mappingName,
                    promiseIndex++
                );
            });
        }

        var byIndexPromise = Promise.resolve();
        if (modelColumnMapping.byIndex) {
            console.log(" - Found byIndex mappings.");
            byIndexPromise = Promise.mapSeries(
                modelColumnMapping.byIndex,
                function(byIndexMapping) {
                    var index = byIndexMapping.index;
                    console.log(
                        "   - Executing byIndex mapping for index: " + index
                    );
                    if (!_.isInteger(index) || index > inputValues.length - 1) {
                        console.log(
                            "   - Skipping byIndex mapping, split result does not contain index: " +
                                index
                        );
                        return Promise.resolve(defaultMappingResult);
                    } else {
                        var indexValue = inputValues[index];
                        console.log(
                            "   - Executing byIndex mapping with value: " +
                                indexValue
                        );
                        return this._executeMapping(
                            record,
                            indexValue,
                            encounter,
                            encounterForm,
                            modelDefinition,
                            byIndexMapping.mapping,
                            mappingName,
                            index
                        );
                    }
                }
            );
        }

        return Promise.all([forEachPromise, byIndexPromise]).spread(function(
            forEachResults,
            byIndexResults
        ) {
            console.log(" - Completed all split mappings:");
            return Promise.resolve(
                _.concat(
                    _.flatten(_.compact(forEachResults)),
                    _.flatten(_.compact(byIndexResults))
                )
            );
        });
    }

    _executeMapping(
        record,
        inputValue,
        encounter,
        encounterForm,
        modelDefinition,
        modelColumnMapping,
        mappingName,
        index
    ) {
        if (_.isArray(modelColumnMapping)) {
            return Promise.mapSeries(modelColumnMapping, function(mapping) {
                return this._executeMapping(
                    record,
                    inputValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    mapping,
                    mappingName,
                    index
                );
            }).then(function(mappingResults) {
                var results = _.flatten(_.compact(mappingResults));
                return Promise.resolve(results);
            });
        }

        var formattedValue = inputValue;
        if (modelColumnMapping.hasOwnProperty("value")) {
            formattedValue = modelColumnMapping.value;
        }

        formattedValue = this._applyMappingRegex(
            formattedValue,
            modelColumnMapping
        );
        formattedValue = this._applyMappingExpression(
            formattedValue,
            modelColumnMapping
        );
        formattedValue = this._applyMappingConversion(
            formattedValue,
            modelColumnMapping
        );

        // If skipIfNotSet is true, we skip this mapping if the value isn't set
        var skipIfNotSet =
            this.importConfig.modelColumnMapping.skipIfNotSet === true;
        if (skipIfNotSet && (formattedValue == null || formattedValue === "")) {
            return Promise.resolve({
                updates: [],
                valid: true,
                hasError: false,
                error: null,
                originalValue: inputValue,
                formattedValue: formattedValue,
                convertedValue: undefined,
                skipped: true
            });
        }

        // Generate updates for the specified mapping type. Defaults to a mapping
        // that will determine the conversion based on the model property type.
        switch (modelColumnMapping.mappingType) {
            case "provider": {
                return this.executeProviderMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName,
                    index
                );
            }
            case "modelMapSelectGroup": {
                return this.executeModelMapSelectGroupMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName
                );
            }
            case "split": {
                return this.executeSplitMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName,
                    index
                );
            }
            case "coalesce": {
                return this.executeCoalesceMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName,
                    index
                );
            }
            case "booleanMultiSelectGroup": {
                return this.executeBooleanMultiSelectGroupMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName,
                    index
                );
            }
            default: {
                return this.executeDefaultMapping(
                    record,
                    formattedValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName,
                    index
                );
            }
        }
    }

    executeMappings(encounter, encounterForm, modelDefinition, record) {
        var modelPropertyUpdates = [];
        var completedMappings = [];
        console.log("Executing column mappings.");
        return Promise.mapSeries(
            Object.keys(this.importConfig.modelColumnMapping),
            function(mappingName) {
                console.log("- Executing mapping: " + mappingName);
                var modelColumnMapping = this.importConfig.modelColumnMapping[
                    mappingName
                ];
                var inputValue = this.getRecordValue(record, mappingName);

                return this._executeMapping(
                    record,
                    inputValue,
                    encounter,
                    encounterForm,
                    modelDefinition,
                    modelColumnMapping,
                    mappingName
                )
                    .then(function(mappingResult) {
                        if (_.isArray(mappingResult)) {
                            _.each(mappingResult, function(result) {
                                result.mappingName = mappingName;
                            });
                        } else {
                            mappingResult.mappingName = mappingName;
                        }
                        return Promise.resolve(mappingResult);
                    })
                    .then(function(mappingResult) {
                        console.log("  - Completed mapping."); // + JSON.stringify(mappingResult));
                        return Promise.resolve(mappingResult);
                    });
            }
        ).then(function(mappingResults) {
            return Promise.resolve(_.flatten(mappingResults));
        });
    }

    _applyMappingRegex(value, modelColumnMapping) {
        if (value && modelColumnMapping.regex) {
            var regexp = new RegExp(modelColumnMapping.regex);
            var groups = regexp.exec(value.toString());
            if (groups && groups.length > 1) {
                return groups[1];
            } else {
                console.warn(
                    "  - Executing regex on mapping, no match found. Defaulting to null."
                );
                return null;
            }
        }

        return value;
    }

    _applyMappingExpression(value, modelColumnMapping) {
        // Handle conversion if defined in mapping.
        if (value && modelColumnMapping.expression) {
            if (_.isFunction(modelColumnMapping.expression)) {
                return modelColumnMapping.expression.call(
                    this,
                    value,
                    modelColumnMapping
                );
            }
        }
        return value;
    }

    _applyMappingConversion(value, modelColumnMapping) {
        // Handle conversion if defined in mapping.
        if (value && modelColumnMapping.conversion) {
            if (modelColumnMapping.conversion.hasOwnProperty(value)) {
                return modelColumnMapping.conversion[value];
            } else if (
                modelColumnMapping.conversion.hasOwnProperty("#default")
            ) {
                return modelColumnMapping.conversion["#default"];
            }
        }
        return value;
    }

    putEncounter(encounter) {
        // Create our own service so we can handle the errors on our own.
        var serviceConfig = _.clone(this.serviceConfig);
        delete serviceConfig.rejectServiceError;
        var encounterService = new graphium.EncounterService(serviceConfig);
        var encounterAction;

        console.log(
            "Retrieving encounter for encounter number: " +
                encounter.encounterNumber
        );
        return encounterService
            .getEncounterIdByEncounterNumber(
                encounter.facilityId,
                encounter.encounterNumber
            )
            .then(function(getEncounterResult) {
                if (
                    getEncounterResult.hasError &&
                    getEncounterResult.errorText.indexOf(
                        "Unable to find encounter"
                    ) >= 0
                ) {
                    if (this.importConfig.abortIfEncounterNotFound) {
                        console.log(
                            "Unable to find existing encounter, skipping record."
                        );
                        return Promise.reject(
                            new Error(
                                "Skipping record, existing encounter not found."
                            )
                        );
                    }

                    console.log(
                        "Unable to find encounter, creating encounter."
                    );
                    encounterAction = "CREATE";
                    return encounterService.createEncounter(encounter);
                } else if (getEncounterResult.hasError) {
                    console.log(
                        "Unable to retrieve encounter, service error: " +
                            getEncounterResult.errorText
                    );
                    return Promise.reject(
                        new Error("Service error trying to perform import.")
                    );
                } else {
                    console.log(
                        "Found encounter, patching with latest demographics."
                    );
                    encounterAction = "PATCH";
                    return encounterService.patchEncounter(
                        getEncounterResult.result,
                        encounter
                    );
                }
            })
            .then(function(createOrPutEncounterResult) {
                if (!createOrPutEncounterResult.hasError) {
                    this.results.encounter = createOrPutEncounterResult.result;
                    this.results.events.push({
                        type: "ENCOUNTER_" + encounterAction,
                        encounterId:
                            createOrPutEncounterResult.result.encounterId
                    });

                    console.log("Completed create/patch of encounter.");
                    return Promise.resolve(createOrPutEncounterResult.result);
                } else {
                    console.log("Unable to patch/create encounter.");
                    return Promise.reject(
                        new Error(
                            "Unable to create/update encounter: " +
                                createOrPutEncounterResult.errorText
                        )
                    );
                }
            });
    }

    // Credit to https://github.com/sfarthin/intercept-stdout Modified to allow for turning off
    // redirecting to stdout once intercepted.
    interceptConsole(stdoutIntercept, stderrIntercept?) {
        stderrIntercept = stderrIntercept || stdoutIntercept;

        var old_stdout_write = process.stdout.write;
        var old_stderr_write = process.stderr.write;

        process.stdout.write = (function(write) {
            return function(buffer, encoding?, fd?): boolean {
                var args = _.toArray(arguments);
                args[0] = interceptor(buffer, stdoutIntercept);
                if (!this.hideConsoleOutput) write.apply(process.stdout, args);
                return true;
            };
        })(process.stdout.write);

        process.stderr.write = (function(write) {
            return function(buffer, encoding?, fd?): boolean {
                var args = this.toArray(arguments);
                args[0] = interceptor(buffer, stderrIntercept);
                if (!this.hideConsoleOutput) write.apply(process.stderr, args);
                return true;
            };
        })(process.stderr.write);

        function interceptor(string, callback) {
            // only intercept the string
            var result = callback(string);
            if (typeof result == "string") {
                string =
                    result.replace(/\n$/, "") +
                    (result && /\n$/.test(string) ? "\n" : "");
            }
            return string;
        }

        // puts back to original
        return function unhook() {
            process.stdout.write = old_stdout_write;
            process.stderr.write = old_stderr_write;
        };
    }

    public importRecord() {
        var intercept = require("intercept-stdout");
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

    tagForm(encounterForm, formTagName, formTagCategory) {
        if (formTagName && formTagCategory) {
            console.log("Import config specifies form tag, tagging form.");
            return this.serviceUtils.tagService
                .getTags()
                .then(function(tagsResult) {
                    var matchingTag = _.find(tagsResult.result, {
                        tagName: formTagName,
                        categoryName: formTagCategory
                    });
                    var existingTag = _.find(encounterForm.formTags, function(
                        formTag
                    ) {
                        return formTag.tag.tagId == matchingTag.tagId;
                    });

                    if (existingTag) {
                        console.log(
                            "Form is already tagged, skipping tagging."
                        );
                        return Promise.resolve();
                    } else if (!matchingTag) {
                        console.log(
                            "Cannot find a tag defined with the specified name and category."
                        );
                        return Promise.reject(
                            new Error(
                                "Cannot find a tag defined with the specified name and category: " +
                                    formTagName +
                                    ", " +
                                    formTagCategory
                            )
                        );
                    } else {
                        console.log("Tagging encounter form.");
                        return this.serviceUtils.tagService.addTagToForm(
                            encounterForm.encounterFormId,
                            matchingTag.tagId
                        );
                    }
                });
        } else {
            console.log("Skipping form tagging, no tag specified in config.");
            return Promise.resolve();
        }
    }

    _importRecord() {
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
            baseServiceUrl:
                this.importConfig.graphiumServiceUrl ||
                "https://service.graphiumemr.com/emr/rest/",
            enableDiskCaching: this.importConfig.enableDiskCaching,
            rejectServiceError: true
        };

        this.serviceUtils = new GraphiumServiceUtils(this.serviceConfig);
        if (!this.serviceConfig.orgInternalName) {
            this.results.error = new Error(
                "Unable to calculate org internal name, aborting import."
            );
            return Promise.resolve(this.results);
        }

        try {
            var generatedEncounter = this.generateEncounterFromRecord(
                this.record
            );
        } catch (error) {
            error.message = "Unable to generate encounter: " + error.message;
            this.results.error = error;
            console.log(error.message);
            return Promise.resolve(this.results);
        }

        var persistedEncounter;
        var encounterForm;
        var modelDefinition;
        var percentComplete;

        var skipFormError = new Error(
            "Skipping form creation as directed by configuration."
        );
        this.results.encounter = generatedEncounter;

        return this.putEncounter(generatedEncounter)
            .then(function(persistedEncounterResult) {
                persistedEncounter = persistedEncounterResult;
                this.results.encounterId = persistedEncounterResult.encounterId;
                this.results.facilityId = persistedEncounterResult.facilityId;
                this.results.encounterNumber =
                    persistedEncounterResult.encounterNumber;

                if (this.importConfig.skipEncounterFormCreateOrUpdate) {
                    return Promise.reject(skipFormError);
                }

                return this.findOrCreateForm(persistedEncounter, this.record);
            })
            .then(function(encounterFormResult) {
                this.results.encounterFormId =
                    encounterFormResult.encounterFormId;
                return this.serviceUtils.parseFormDefinitionContent(
                    encounterFormResult
                );
            })
            .then(function(encounterFormWithParsedFormDefinition) {
                encounterForm = encounterFormWithParsedFormDefinition;
                var modelDefinitionName =
                    encounterForm.formDef.parsedFormDefinition.form.$.modelName;
                return this.serviceUtils.getCachedModelDefinition(
                    modelDefinitionName
                );
            })
            .then(function(modelDefinitionResult) {
                modelDefinition = modelDefinitionResult;
                return this.executeMappings(
                    persistedEncounter,
                    encounterForm,
                    modelDefinition,
                    this.record
                );
            })
            .then(function(mappingResults) {
                var updates = _.flatMap(mappingResults, "updates");

                var importResult = _.defaults(this.importConfig.importResult, {
                    importedAt: Date.now()
                });
                if (this.importConfig.includeDataInResults) {
                    importResult.sourceData = this.record;
                }

                updates.push({
                    propertyName: "import_result",
                    fieldValue: JSON.stringify(importResult),
                    percentComplete: 0,
                    formValid: false
                });
                //console.log(' - Setting import result: ' + JSON.stringify(importResult));

                var validation = _.transform(
                    mappingResults,
                    function(accumulator, result) {
                        accumulator.errorCount += result.hasError === true;
                        accumulator.validCount += result.valid === true;
                        accumulator.total++;
                        accumulator.percentComplete =
                            accumulator.validCount / accumulator.total;
                    },
                    { validCount: 0, total: 0, errorCount: 0 }
                );

                // Update the percentComplete in the modelPropertyUpdate
                _.forEach(updates, function(update) {
                    (update.percentComplete = validation.percentComplete),
                        (update.formValid = validation.percentComplete == 1);
                });

                this.results.validation = validation;
                this.results.mappings = mappingResults;

                if (validation.errorCount > 0) {
                    console.log(
                        "Warning, some mappings failed and need to be reviewed:"
                    );
                    _.forEach(mappingResults, function(mappingResult) {
                        if (mappingResult.hasError)
                            console.log(
                                " - [" +
                                    mappingResult.mappingName +
                                    "] " +
                                    mappingResult.error.message
                            );
                    });
                }

                //console.log('Updating form properties:');
                //_.forEach(updates, function(update) {
                //  console.log(' - Update: ' + update.propertyName + (update.propertySequence ? '['+update.propertySequence+']':'') + ' => ' + update.fieldValue);
                //})

                return this.serviceUtils.formService.updateEncounterFormModel(
                    encounterForm.encounterFormId,
                    updates
                );
                //}
            })
            .then(function(updateEncounterFormModelResult) {
                console.log(
                    `Completed updating form (Percent Complete: ${Math.floor(
                        this.results.validation.percentComplete * 100
                    )}, Mapping Errors: ${this.results.validation.errorCount})`
                );
                console.log(
                    `Encounter ID: ${this.results.encounterId} Form ID: ${this
                        .results.encounterFormId}`
                );
                this.results.events.push({
                    type: "ENCOUNTERFORM_UPDATE",
                    encounterId: this.results.encounterId,
                    encounterFormId: this.results.encounterFormId,
                    updatedFormVersion: updateEncounterFormModelResult.result
                });

                if (
                    !this.importConfig.calculatePqrs &&
                    !this.importConfig.calculateQcdr
                ) {
                    return Promise.resolve(null);
                } else {
                    var dosColumnMappingName = this.importConfig
                        .dosColumnMappingName;
                    if (!dosColumnMappingName) {
                        return Promise.reject(
                            new Error(
                                "Unable to calculate QCDR results, dosColumnMappingName not specified in import config."
                            )
                        );
                    }

                    var dosMappingResult = _.find(
                        this.results.mappings,
                        function(mappingResult) {
                            return (
                                mappingResult.mappingName ==
                                dosColumnMappingName
                            );
                        }
                    );
                    if (!dosMappingResult || !dosMappingResult.convertedValue) {
                        return Promise.reject(
                            new Error(
                                "Unable to calculate QCDR results, unable to find value for date of service column mapping."
                            )
                        );
                    }

                    var year = dosMappingResult.convertedValue.substr(0, 4);
                    if (year == "2016") {
                        var pqrsEval = new EncounterFormPqrsEval(
                            this.serviceConfig,
                            persistedEncounter.facilityId,
                            encounterForm.encounterFormId
                        );
                        return pqrsEval.evaluateForm(true);
                    } else if (year == "2017") {
                        var qcdr2017Eval = new EncounterFormMacraEval2017(
                            this.serviceConfig,
                            persistedEncounter.facilityId,
                            encounterForm.encounterFormId
                        );
                        return qcdr2017Eval.evaluateForm(true);
                    } else {
                        return Promise.reject(
                            new Error(
                                "QCDR evaluation logic for " +
                                    year +
                                    "year unavailable."
                            )
                        );
                    }
                }
            })
            .then(function(qcdrEvalResults) {
                if (
                    !this.importConfig.calculatePqrs &&
                    !this.importConfig.calculateQcdr
                ) {
                    console.log("Skipping PQRS evaluation.");
                    return Promise.resolve();
                }

                if (this.importConfig.calculateQcdr) {
                    this.results.qcdrEvalResults = qcdrEvalResults;
                } else {
                    this.results.pqrsEvalResults = qcdrEvalResults;
                }

                if (qcdrEvalResults.hasError) {
                    console.log(
                        "Unable to calculate PQRS results: " +
                            qcdrEvalResults.errorText
                    );
                    return Promise.resolve();
                } else {
                    console.log("Calculated PQRS results. Saving to form.");
                    return this.serviceUtils.formService.updateEncounterFormModel(
                        encounterForm.encounterFormId,
                        qcdrEvalResults.modelUpdates
                    );
                }
            })
            .then(function() {
                return this.tagForm(
                    encounterForm,
                    this.importConfig.formTagName,
                    this.importConfig.formTagCategory
                );
            })
            .then(function(tagResult) {
                return Promise.resolve(this.results);
            })
            .catch(function(error) {
                if (error == skipFormError) {
                    return Promise.resolve(this.results);
                } else {
                    this.results.error = error;
                    console.log("Aborting record import - " + error.message);
                    console.log(error.stack);
                    if (error.result && error.result.hasError)
                        console.log(
                            "- Service error: " + error.result.errorText
                        );
                    return Promise.resolve(this.results);
                }
            });
    }

    private safeExtractTime(dateTimeString):string {
        if (!dateTimeString) return null;

        var matchesTimeString = dateTimeString.match(/(\d{2}:\d{2}:\d{2})/g);
        if (matchesTimeString) return matchesTimeString[0];

        var matchesNumber = dateTimeString.match(
            /^([0-2]?[0-9]?[0-5]?[0-9]?)$/
        );
        if (matchesNumber) dateTimeString = _.padStart(dateTimeString, 4, "0");

        var matches24HrTime = dateTimeString.match(
            /^([01]\d|2[0-3]):?([0-5]\d)$/
        );
        if (matches24HrTime)
            return [matches24HrTime[1], matches24HrTime[2], "00"].join(":");

        return null;
    }

    private correctCommonYearErrors(yearString) {
        if (yearString && _.isString(yearString)) {
            if (_.startsWith(yearString, "02"))
                return "20" + yearString.substr(2);
            else if (_.startsWith(yearString, "91"))
                return "19" + yearString.substr(2);
        }
        return yearString;
    }

    private parseTwoDigitYearThisYearOrEarlier(input) {
        var currentTwoDigitYear = parseInt(
            new Date()
                .getFullYear()
                .toString()
                .substr(2, 2)
        );

        var fullYear = "20" + input;
        if (input > currentTwoDigitYear) fullYear = "19" + input;

        return fullYear;
    }

    private safeExtractDate(dateTimeString, sourceDateTimeFormat) {
        if (!dateTimeString) return null;

        moment.parseTwoDigitYear = this.parseTwoDigitYearThisYearOrEarlier;

        var defaultDateFormats = [
            "MM-DD-YYYY",
            "M/D/YY",
            "MM/DD/YYYY",
            "MM-DD-YY",
            "M-D-YYYY",
            "M-D-YY",
            "YYYY-MM-DD"
        ];
        var dateParsingFormats = sourceDateTimeFormat
            ? [sourceDateTimeFormat]
            : defaultDateFormats;
        var strictParsing = sourceDateTimeFormat != null;
        console.log(
            "  - Parsing date with the following formats: " +
                JSON.stringify(dateParsingFormats)
        );
        console.log("  - Strictly parsing date: " + strictParsing);
        var mdate = moment(dateTimeString, dateParsingFormats, strictParsing);
        if (mdate.isValid()) {
            var parsedDateString = this.correctCommonYearErrors(
                mdate.format("YYYY-MM-DD")
            );

            // Also make sure the date is within a reasonable date (ie. in the 1900s or 2000s)
            var range = moment.range(
                new Date(1900, 1, 1),
                moment().add(1, "y")
            );

            if (range.contains(moment(parsedDateString, "YYYY-MM-DD"))) {
                console.log(
                    "  - Parsed date (original, parsed): (" +
                        dateTimeString +
                        ", " +
                        parsedDateString +
                        ")"
                );
                return parsedDateString;
            } else {
                console.log(
                    "  - Unable to convert date, appears to be outside reasonable range (original,parsed): (" +
                        dateTimeString +
                        ", " +
                        parsedDateString +
                        ")"
                );
                return null;
            }
        } else {
            // Give up.
            console.log(
                "  - Unable to parse date from string: " + dateTimeString
            );
            return null;
        }
    }
}
