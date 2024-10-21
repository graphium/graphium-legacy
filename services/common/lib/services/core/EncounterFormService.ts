import { ServiceRequest } from "./ServiceRequest";

export class EncounterFormService {
    readonly serviceRequest: ServiceRequest;

    constructor(orgName: string, username: string, password: string) {
        this.serviceRequest = new ServiceRequest(orgName, username, password);
    }

    async getEncounterForm(encounterFormId, withStrokes, withModelData) {
        var requestOptions = {
            uri: "encounter/form/" + encounterFormId,
            method: "GET",
            qs: {
                withStrokes: withStrokes,
                withModelData: withModelData
            }
        };

        return this.serviceRequest.callService(requestOptions);
    }

    async getEncounterFormData(encounterFormId) {
        var requestOptions = {
            uri: "encounter/form/" + encounterFormId + "/model/data",
            method: "GET",
            qs: {
                withBitmapContent: false
            }
        };

        return this.serviceRequest.callService(requestOptions);
    }

    async getFormDefinitionById(formDefinitionId, withPageContent) {
        var requestOptions = {
            uri: "form/definition/" + formDefinitionId,
            method: "GET",
            qs: {
                withPageContent: withPageContent
            }
        };

        return this.serviceRequest.callService(requestOptions);
    }
}
