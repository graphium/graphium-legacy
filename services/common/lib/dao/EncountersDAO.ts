import * as orgModels from '../model/OrgModels';

export async function getEncounters(orgInternalName:string, filter:object, offset:number, limit:number) {
    if (!orgInternalName) {
        throw new Error('Missing parameter orgInternalName.');
    }

    let models = await orgModels.getModelsForOrg(orgInternalName);
    let results = await models.Encounter.findAndCountAll({
        where: filter,
        include: [{ model: models.Facility, as: 'facility', required: true}],
        limit: limit,
        offset: offset,
    }).catch((error) => {console.log(error)});
    return results;
}