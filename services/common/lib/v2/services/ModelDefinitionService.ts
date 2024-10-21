import { Connection, EntityManager } from 'typeorm';
import { ModelDefinition } from '../entity/org/ModelDefinition';
import { ModelDefinitionSchema } from '../../model/model/ModelDefinitionSchema';

export const getModelDefinitionByName = async (
    connection: Connection | EntityManager,
    modelDefinitionName: string,
): Promise<ModelDefinition> => {
    let modelDefinition = await connection
        .createQueryBuilder()
        .select('model_defn')
        .from(ModelDefinition, 'model_defn')
        .addSelect('model_defn.modelDefnCntnt')
        .where('model_defn.modelDefnNm = :modelDefinitionName', { modelDefinitionName })
        .cache(60 * 10 * 1000)
        .getOne();

    if (modelDefinition) {
        await modelDefinition.parseModelDefinitionContent();
    }

    return modelDefinition;
};

export const getModelDefinitionById = async (
    connection: Connection | EntityManager,
    modelDefinitionId: number,
): Promise<ModelDefinition> => {
    let modelDefinition = await connection
        .createQueryBuilder()
        .select('model_defn')
        .from(ModelDefinition, 'model_defn')
        .addSelect('model_defn.modelDefnCntnt')
        .where('model_defn.modelDefnId = :modelDefinitionId', { modelDefinitionId })
        .getOne();

    if (modelDefinition) {
        await modelDefinition.parseModelDefinitionContent();
    }

    return modelDefinition;
};

export const getAllModelDefinitions = async (
    connection: Connection | EntityManager,
    currentVersions?: Array<{ modelDefinitionId: number; modelDefinitionVersion: number }>,
): Promise<ModelDefinition[]> => {
    let query = connection
        .createQueryBuilder()
        .select('modelDefinition')
        .from(ModelDefinition, 'modelDefinition')
        .addSelect('modelDefinition.modelDefnCntnt');

    if (currentVersions && currentVersions.length > 0) {
        currentVersions.forEach((value, index) => {
            query.andWhere(
                `("modelDefinition".model_defn_id, "modelDefinition".model_defn_ver) <> (:modelDefinitionId${index}, :modelDefinitionVersion${index})`,
                {
                    [`modelDefinitionId${index}`]: value.modelDefinitionId,
                    [`modelDefinitionVersion${index}`]: value.modelDefinitionVersion,
                },
            );
        });
    }

    let modelDefinitions = await query.getMany();

    for (let md of modelDefinitions) {
        await md.parseModelDefinitionContent();
    }

    return modelDefinitions;
};
