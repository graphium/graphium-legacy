import { FormPage } from './FormPage';
import { FormStroke } from './FormStroke';
import { FormTag } from './FormTag';
import { FormModelData } from './FormModelData';
import { FormDefinition } from './FormDefinition';

export interface Form {
    encounterFormId: number;
    encounterId: string;
    formDefinitionId: number;
    formDefinitionVersion: number;
    formDefinitionType: string;
    formValid: boolean;
    voided: boolean;
    percentComplete?: number | null;
    lastOpenedDate?: number | null;
    createTime: Date | string;
    updateTime: Date | string;
    auditVersion: number;
    pages: FormPage[];
    strokes: FormStroke[];
    formTags: FormTag[];
    modelData: FormModelData;
    formDef: FormDefinition;
}
