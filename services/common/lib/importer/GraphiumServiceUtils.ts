var graphium = require("@graphiumhealth/graphium-sdk");
var _ = require("lodash");

import { GraphiumServiceUtilsCache } from "./GraphiumServiceUtilsCache";
import { GraphiumServiceConfig } from "../services/core/GraphiumServiceConfig";

export class GraphiumServiceUtils {
    readonly cache: GraphiumServiceUtilsCache;
    readonly formCache: GraphiumServiceUtilsCache;

    public formService:any;
    public searchService:any;
    public encounterService:any;
    public encounterFormService:any;
    public facilityService:any;
    public tagService:any;

    constructor(readonly serviceConfig: GraphiumServiceConfig) {
        this.serviceConfig = serviceConfig;
        this.generateServiceObjects();
        this.cache = new GraphiumServiceUtilsCache(
            serviceConfig.enableDiskCaching
        );
        this.formCache = new GraphiumServiceUtilsCache(true); // Forms definitions are always cached to disk.
    }

    parseFormDefinitionContent(encounterForm) {
        if (!_.isString(encounterForm.formDef.formDefinitionContent)) {
            return Promise.reject(
                new Error(
                    "Cannot parse formDefinitionContent, is not a string."
                )
            );
        }

        return new Promise(function(resolve, reject) {
            require("xml2js").parseString(
                encounterForm.formDef.formDefinitionContent,
                {},
                function(parseXmlError, parseXmlResult) {
                    if (parseXmlError) {
                        reject(
                            new Error(
                                "Unable to parse form definition content XML."
                            )
                        );
                        return;
                    }

                    encounterForm.formDef.parsedFormDefinition = parseXmlResult;
                    resolve(encounterForm);
                }
            );
        });
    }

    generateServiceObjects() {
        this.searchService = new graphium.SearchService(this.serviceConfig);
        this.encounterService = new graphium.EncounterService(
            this.serviceConfig
        );
        this.formService = new graphium.FormService(this.serviceConfig);
        this.encounterFormService = new graphium.EncounterFormService(
            this.serviceConfig
        );
        this.facilityService = new graphium.FacilityService(this.serviceConfig);
        this.tagService = new graphium.TagService(this.serviceConfig);
    }

    getCachedFormDefinitionWithContent(formDefinitionId, versionNumber) {
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            formDefinitionId,
            versionNumber,
            "formDefinitionWithContent"
        ].join(":");
        var cachedFormDefinition = this.formCache.getItem(cacheKey);
        if (cachedFormDefinition) return Promise.resolve(cachedFormDefinition);

        var _this = this;
        return this.formService
            .getFormDefinitionVersion(formDefinitionId, versionNumber, true)
            .then(function(formDefinitionResult) {
                _this.formCache.setItem(cacheKey, formDefinitionResult.result);
                return Promise.resolve(formDefinitionResult.result);
            });
    }

    getCachedModelDefinition(modelDefinitionName) {
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            modelDefinitionName,
            "modelDefinition"
        ].join(":");
        var cachedModelDefinition = this.cache.getItem(cacheKey);
        if (cachedModelDefinition)
            return Promise.resolve(cachedModelDefinition);

        var _this = this;
        return this.formService
            .getModelDefinitionByName(modelDefinitionName)
            .then(function(modelDefinitionResult) {
                _this.cache.setItem(cacheKey, modelDefinitionResult.result);
                return Promise.resolve(modelDefinitionResult.result);
            });
    }

    clearCachedProviders(facilityId) {
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            facilityId,
            "providers"
        ].join(":");

        this.cache.removeItem(cacheKey);
    }

    getCachedProviders(facilityId) {
        var _this = this;
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            facilityId,
            "providers"
        ].join(":");
        var cachedProviders = this.cache.getItem(cacheKey);
        if (cachedProviders) return Promise.resolve(cachedProviders);

        return this.facilityService
            .getProvidersForFacility(facilityId)
            .then(function(getProviderResult) {
                _this.cache.setItem(cacheKey, getProviderResult.result, true);
                return Promise.resolve(getProviderResult.result);
            })
            .catch(function(error) {
                console.error(error.message);
                console.error(error.stack);
                return Promise.reject(
                    new Error("Unable to retrieve providers for facility.")
                );
            });
    }

    getProviderByNpi(facilityId, npi, providerType) {
        if (!npi) return Promise.resolve(null);

        return this.getCachedProviders(facilityId).then(function(
            cachedProviders
        ) {
            var findOptions = { nationalProviderId: npi };
            var matchedProvider = _.find(cachedProviders, findOptions);
            if (
                matchedProvider &&
                (!providerType ||
                    matchedProvider.providerType.toLowerCase() ==
                        providerType.toLowerCase())
            )
                return Promise.resolve(matchedProvider);
            else return Promise.resolve(null);
        });
    }

    getProviderByLastName(facilityId, lastName, providerType) {
        if (!lastName) return Promise.resolve(null);

        return this.getCachedProviders(facilityId).then(function(
            cachedProviders
        ) {
            var matchingProviders = _.filter(cachedProviders, function(p) {
                var matchesName =
                    p.lastName &&
                    p.lastName.toLowerCase() == lastName.toLowerCase();
                var matchesProviderType = providerType
                    ? p.providerType.toLowerCase() == providerType.toLowerCase()
                    : true;
                return matchesName && matchesProviderType;
            });
            if (matchingProviders.length > 1) {
                return Promise.reject(
                    new Error(
                        "Found multiple providers with the given last name."
                    )
                );
            } else if (matchingProviders.length == 1) {
                return Promise.resolve(matchingProviders[0]);
            } else {
                return Promise.resolve(null);
            }
        });
    }

    getProviderByLastNameAndFirstName(facilityId, lastAndFirstName, providerType) {
        if (!lastAndFirstName) return Promise.resolve(null);

        var parts = lastAndFirstName.split(',');
        if(parts.length < 2) {
            console.log('Unable to get provider by first and last name, value does not contain a comma separated list of [last name],[first name]');
            return Promise.resolve(null);
        }

        var lastName = _.trim(parts[0]);
        var firstName = _.trim(parts[1]);

        return this.getCachedProviders(facilityId).then(function(
            cachedProviders
        ) {
            var matchingProviders = _.filter(cachedProviders, function(p) {
                var matchesName =
                    p.lastName &&
                    p.lastName.toLowerCase() == lastName.toLowerCase() &&
                    p.firstName &&
                    _.startsWith(p.firstName.toLowerCase(),firstName.toLowerCase());
                var matchesProviderType = providerType
                    ? p.providerType.toLowerCase() == providerType.toLowerCase()
                    : true;
                return matchesName && matchesProviderType;
            });
            if (matchingProviders.length > 1) {
                return Promise.reject(
                    new Error(
                        "Found multiple providers with the same first and last name."
                    )
                );
            } else if (matchingProviders.length == 1) {
                return Promise.resolve(matchingProviders[0]);
            } else {
                return Promise.resolve(null);
            }
        });
    }

    getProviderById(facilityId, providerId, providerType) {
        if (providerId == null) return Promise.resolve(null);

        if (_.isString(providerId)) providerId = parseInt(providerId);

        if (!_.isInteger(providerId)) {
            //console.log('Unable to find provider by ID, providerId is not an integer.');
            return Promise.resolve(null);
        }

        return this.getCachedProviders(facilityId).then(function(
            cachedProviders
        ) {
            var findOptions = { providerId: parseInt(providerId) };
            var matchedProvider = _.find(cachedProviders, findOptions);
            if (
                matchedProvider &&
                (!providerType ||
                    matchedProvider.providerType.toLowerCase() ==
                        providerType.toLowerCase())
            )
                return Promise.resolve(matchedProvider);
            else return Promise.resolve(null);
        });
    }

    getSearchDefinitionId(searchDefinitionName) {
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            searchDefinitionName,
            "searchDefinition"
        ].join(":");
        var cachedSearchDefinition = this.cache.getItem(cacheKey);

        if (cachedSearchDefinition !== undefined) {
            return Promise.resolve(cachedSearchDefinition.searchDefinitionId);
        }

        var _this = this;
        return this.searchService
            .getSearchDefinitions()
            .then(function(searchDefinitionsResult) {
                var searchDefinition = _.find(searchDefinitionsResult.result, {
                    searchDefinitionName: searchDefinitionName
                });

                if (!searchDefinition)
                    throw new Error(
                        "Unable to locate search definition " +
                            searchDefinitionName
                    );
                else _this.cache.setItem(cacheKey, searchDefinition);

                return Promise.resolve(searchDefinition.searchDefinitionId);
            });
    }

    getSearchResultsBySearchName(searchName, searchParameters) {
        var _this = this;

        return this.getSearchDefinitionId(searchName)
            .then(function(searchDefinitionId) {
                return _this.searchService.getSearchResults(
                    searchDefinitionId,
                    searchParameters,
                    null,
                    "-1"
                );
            })
            .then(function(searchResult) {
                return Promise.resolve(searchResult.result);
            });
    }

    // This will add a given tag name/category to an encounter form. Note that this does NOT check for the
    // existence of the given tag first.
    tagForm(encounterFormId, formTagName, formTagCategory) {
        var _this = this;

        if (formTagName && formTagCategory) {
            var tagsCacheKey = [
                this.serviceConfig.orgInternalName,
                "tags"
            ].join(":");
            var existingTags = this.cache.getItem(tagsCacheKey);
            var getTagsPromise = existingTags
                ? Promise.resolve({ result: existingTags })
                : _this.tagService.getTags();

            return getTagsPromise.then(function(tagsResult) {
                _this.cache.setItem(tagsCacheKey, tagsResult.result);
                var matchingTag = _.find(tagsResult.result, {
                    tagName: formTagName,
                    categoryName: formTagCategory
                });

                if (!matchingTag) {
                    return Promise.reject(
                        new Error(
                            "Cannot find a tag defined with the specified name and category: " +
                                formTagName +
                                ", " +
                                formTagCategory
                        )
                    );
                } else {
                    return _this.tagService.addTagToForm(
                        encounterFormId,
                        matchingTag.tagId
                    );
                }
            });
        } else {
            return Promise.reject(
                new Error("Must specify a tag name and a tag category.")
            );
        }
    }

    getFacilityFormDefinition(facilityId, formDefinitionName) {
        var cacheKey = [
            this.serviceConfig.orgInternalName,
            facilityId,
            formDefinitionName,
            "formDefinitionId"
        ].join(":");
        var cachedFormDefinitionId = this.cache.getItem(cacheKey);

        if (cachedFormDefinitionId !== undefined)
            return Promise.resolve(cachedFormDefinitionId);

        var searchParameters = [];
        searchParameters.push({
            parameterName: "fac_id",
            parameterValue: parseInt(facilityId)
        });
        searchParameters.push({
            parameterName: "form_defn_nm",
            parameterValue: formDefinitionName
        });

        return this.getSearchResultsBySearchName(
            "system.getCurrentActiveFormDefinitions",
            searchParameters
        );
    }

    createEncounterForm(facilityId, encounterId, formDefinitionName) {
        console.log(
            "Retrieving form definitions, looking for " + formDefinitionName
        );
        var _this = this;
        return this.getFacilityFormDefinition(
            facilityId,
            formDefinitionName
        ).then(function(getFormResult) {
            if (getFormResult.length == 0)
                throw new Error(
                    "Unable to create form, did not find form definition " +
                        formDefinitionName +
                        "."
                );
            if (getFormResult.length > 1)
                throw new Error(
                    "Unable to create form, found more than 1 form definition with the name " +
                        formDefinitionName +
                        "."
                );

            var formDef = getFormResult[0];
            var encounterForm = {
                encounterId: encounterId,
                formDefinitionId: formDef.form_defn_id,
                formDefinitionVersion: formDef.form_defn_ver
            };

            console.log(
                "Creating new encounter form with form definition ID: " +
                    formDef.form_defn_id
            );
            return _this.formService.createFormForEncounter(
                encounterId,
                encounterForm
            );
        });
    }

    getFirstPageIdByName(pageName, pages) {
        var page = _.find(pages, { pageName: pageName });
        if (page) return page.pageId;
        return null;
    }

    getModelMapItem(
        encounterForm,
        keyPropertyName,
        valuePropertyName,
        key,
        pageId
    ) {
        console.log("NOOP");
    }

    getOrGenerateSequenceNumberForProperty(
        encounterForm,
        keyPropertyName,
        key,
        appendSequenceNumbers
    ) {
        var existingDetail = _.find(encounterForm.modelData.formDetails, {
            propertyName: keyPropertyName,
            propertyValue: key
        });
        //console.log('Passed in appended sequence numbers: ' + JSON.stringify(appendSequenceNumbers));
        if (existingDetail) {
            //console.log('Found existing sequence number for this property: ' + existingDetail.propertySequence);
            return existingDetail.propertySequence;
        } else {
            //console.log('Generating sequence number since one doesn\'t exist.');
            var sequenceNumbers = [];
            for (var i = 0; i < encounterForm.modelData.formDetails; i++) {
                var detail = encounterForm.modelData.formDetails[i];
                //console.log('Getting sequence number from detail: ' + detail.propertySequence);
                if (detail && detail.hasOwnProperty("propertySequence")) {
                    sequenceNumbers.push(parseInt(detail.propertySequence));
                }
            }

            //console.log('All existing sequence numbers: ' + JSON.stringify(sequenceNumbers));
            if (_.isArray(appendSequenceNumbers)) {
                sequenceNumbers = _.concat(
                    sequenceNumbers,
                    appendSequenceNumbers
                );
                //console.log('Added the existing sequence numbers to appended sequence numbers: ' + JSON.stringify(sequenceNumbers));
            } else {
                //console.log('No appended sequence numbers passed in.');
            }

            var maxSequenceNumber = _.max(sequenceNumbers);
            //console.log('Max sequence number: ' + maxSequenceNumber);
            if (maxSequenceNumber == null) {
                //console.log('No max sequence found, passing back 0.');
                maxSequenceNumber = 0;
            }
            return maxSequenceNumber + 1;
        }
    }

    cleanModelPropertyUpdates(updates) {
        _.forEach(updates, function(update) {});
    }

    getAllSequenceNumbersForModelMapKey(encounterForm, keyPropertyName) {
        return _.map(
            _.filter(encounterForm.modelData.formDetails, {
                propertyName: keyPropertyName
            }),
            "propertySequence"
        );
    }
}

export default GraphiumServiceUtils;