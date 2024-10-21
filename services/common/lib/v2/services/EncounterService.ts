import { EncounterForm } from '../entity/org/EncounterForm';
import { Connection, EntityManager, InsertResult, UpdateResult } from 'typeorm';
import * as FormService from './FormService';

export const getEncounterForm = async (
    connection: Connection | EntityManager,
    enctrFormId: EncounterForm['enctrFormId'],
    options: {
        withFormDefinitionContent?: boolean;
        withModelDefinitionContent?: boolean;
        withStrokes?: boolean;
        withModelData?: boolean;
    } = {},
): Promise<EncounterForm> => {
    let query = connection
        .createQueryBuilder()
        .select('encounterForm')
        .from(EncounterForm, 'encounterForm')
        .where('encounterForm.enctrFormId = :enctrFormId', { enctrFormId });

    query.innerJoinAndSelect('encounterForm.formDefinitionHistory', 'formDefinitionHistory');
    query.innerJoinAndSelect('formDefinitionHistory.modelDefinition', 'modelDefinition');

    if (options.withFormDefinitionContent === true) {
        query.addSelect('formDefinitionHistory.formDefnCntnt');
    }

    if (options.withModelDefinitionContent === true) {
        query.addSelect('modelDefinition.modelDefnCntnt');
    }

    let encounterForm = await query.getOne();

    if (!encounterForm) {
        return null;
    }

    let formServiceParams = {
        encounterFormId: encounterForm.enctrFormId,
        modelName: encounterForm.formDefinitionHistory.modelDefinition.modelDefnNm,
    };
    let pages = await FormService.getFormPages(connection, formServiceParams);
    encounterForm.pages = pages;

    if (options.withStrokes === true) {
        let strokes = await FormService.getStrokesForForm(connection, formServiceParams);
        encounterForm.strokes = strokes;
    }

    if (options.withModelData === true) {
        let modelData = await FormService.getModelDataForForm(connection, formServiceParams);
        encounterForm.modelData = modelData;
    }

    return encounterForm;
};
