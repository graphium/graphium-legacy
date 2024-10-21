export interface DataEntryFormDefinition {
    title: string;
    name: string;
    shortTitle?: string;
    orgInternalName?: string;
    systemGlobal: boolean;
    type: 'data_entry' | 'external_web_form';
    retrievableDataKeys: string[];
    excludedDataKeys: string[];
    valueSets:Array<{name:string, category:string}>;
    formDefinitionFrameworkVersion?: '1.0.0' | '1.1.0';
}

export default DataEntryFormDefinition;