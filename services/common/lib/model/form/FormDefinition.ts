export interface FormDefinition {
    formDefinitionId: number;
    formDefinitionName: string;
    formDefinitionTitle: string;
    formDefinitionDescription: string;
    formDefinitionVersion: number;
    formDefinitionContent: {
        form: {
            $: {
                'xmlns:xsi': string;
                'xsi:noNamespaceSchemaLocation': string;
                name: string;
                modelName: string;
                renderType: string;
                version: string;
            };
            title: string[];
            description: string[];
            pages: any[]; // UPDATE
            expressions: any[]; // UPDATE
            valueSets: any[]; // UPDATE
            defaultValues: any[]; // UPDATE
            templates: string[];
        };
    };
    modelDefinitionId: number;
    formDefinitionType: string;
    schemaVersion: string;
    active: boolean;
    createTime: Date | string;
    formDefinitionPages: any[]; // UPDATE
}
