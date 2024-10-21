import { EncounterForm } from '../entity/org/EncounterForm';
import { Connection, EntityManager, EntitySchema } from 'typeorm';
import { EncounterFormTag } from '../entity/org/EncounterFormTag';
import { EncounterFormPage } from '../entity/org/EncounterFormPage';
import * as EncounterFormSchemaFactory from '../entity/org/EncounterFormSchemaFactory';
import { EncounterFormPageStroke } from '../entity/org/EncounterFormPageStroke';
import { EncounterFormData } from '../entity/org/EncounterFormData';
import { EncounterFormBitmap } from '../entity/org/EncounterFormBitmap';
import { EncounterFormDetail } from '../entity/org/EncounterFormDetail';
import { ModelDefinition } from '../entity/org/ModelDefinition';
import { ModelDefinitionSchema } from '../../model/model/ModelDefinitionSchema';
import * as ModelDefinitionService from './ModelDefinitionService';

function getPrimaryFormTable(modelName: string) {
    return ('enctr_form_' + modelName).toLowerCase();
}

function getStrokeTableName(modelName: string) {
    return ('page_' + modelName + '_stroke').toLowerCase();
}

function getStrokeSequenceName(modelName: string) {
    return getStrokeTableName(modelName) + '_seq';
}

function getBitmapTableName(modelName: string) {
    return ('page_' + modelName + '_bmp').toLowerCase();
}

function getDetailTableName(modelName: string) {
    return ('page_' + modelName + '_dtl').toLowerCase();
}

function getPageTableName(modelName: string) {
    return ('page_' + modelName).toLowerCase();
}

const GET_STROKES_FOR_PAGE =
    'SELECT page_stroke_id,\n' +
    '    page_id,\n' +
    '    x,\n' +
    '    y,\n' +
    '    width,\n' +
    '    height,\n' +
    '    scale,\n' +
    '    encod_typ,\n' +
    '    stroke_cntnt,\n' +
    '    ins_dttm\n' +
    'FROM\n' +
    '    :strokeTable ' +
    'WHERE' +
    '   page_id = :formPageId;\n';

const GET_STROKES_FOR_PAGE_NO_CONTENT =
    'SELECT page_stroke_id,\n' +
    '    page_id,\n' +
    '    ins_dttm\n' +
    'FROM\n' +
    '    :strokeTable ' +
    'WHERE' +
    '   page_id = :formPageId;\n';

const GET_STROKES_FOR_FORM =
    'SELECT page_stroke_id,\n' +
    '    page_id,\n' +
    '    x,\n' +
    '    y,\n' +
    '    width,\n' +
    '    height,\n' +
    '    scale,\n' +
    '    encod_typ,\n' +
    '    stroke_cntnt,\n' +
    '    ins_dttm\n' +
    'FROM\n' +
    '    :strokeTable ' +
    'WHERE page_id IN \n' +
    '  (SELECT page_id\n' +
    '   FROM :pageTable \n' +
    '   WHERE enctr_form_id = :encounterFormId)';

const GET_STROKES_FOR_FORM_BY_IDS =
    'SELECT page_stroke_id,\n' +
    '    page_id,\n' +
    '    x,\n' +
    '    y,\n' +
    '    width,\n' +
    '    height,\n' +
    '    scale,\n' +
    '    encod_typ,\n' +
    '    stroke_cntnt,\n' +
    '    ins_dttm\n' +
    'FROM\n' +
    '    :strokeTable ' +
    'WHERE page_id IN \n' +
    '  (SELECT page_id\n' +
    '   FROM :pageTable \n' +
    '   WHERE enctr_form_id = :encounterFormId)\n' +
    'AND page_stroke_id IN (:pageStrokeIds)';

const GET_STROKE_IDS_FOR_FORM =
    'SELECT page_stroke_id \n' +
    'FROM\n' +
    '    :strokeTable ' +
    'WHERE page_id IN \n' +
    '  (SELECT page_id\n' +
    '   FROM :pageTable \n' +
    '   WHERE enctr_form_id = :encounterFormId)';

const GET_FORM_DETAIL_DATA =
    'SELECT page_dtl_id,\n' +
    '  page_id,\n' +
    '  prop_nm,\n' +
    '  prop_seq,\n' +
    '  prop_val,\n' +
    '  ins_dttm,\n' +
    '  upd_dttm,\n' +
    '  aud_ver \n' +
    'FROM :detailTable \n' +
    'WHERE page_id in (SELECT page_id\n' +
    '  FROM :pageTable \n' +
    '  WHERE enctr_form_id = :encounterFormId)';

const GET_FORM_BITMAP_DATA =
    'SELECT page_bmp_id,\n' +
    '    page_id,\n' +
    '    prop_nm,\n' +
    '    prop_seq,\n' +
    '    width,\n' +
    '    height,\n' +
    '    scale,\n' +
    '    encod_typ,\n' +
    '    bmp_cntnt,\n' +
    '    ins_dttm,\n' +
    '    upd_dttm,\n' +
    '    aud_ver\n' +
    'FROM :bitmapTable \n' +
    'WHERE page_id in (SELECT page_id\n' +
    '  FROM :pageTable \n' +
    '  WHERE enctr_form_id = :encounterFormId)';

const GET_BITMAP_DATA_BY_ID =
    'SELECT page_bmp_id,\n' +
    '    page_id,\n' +
    '    prop_nm,\n' +
    '    prop_seq,\n' +
    '    width,\n' +
    '    height,\n' +
    '    scale,\n' +
    '    encod_typ,\n' +
    '    bmp_cntnt,\n' +
    '    ins_dttm,\n' +
    '    upd_dttm,\n' +
    '    aud_ver\n' +
    'FROM :bitmapTable \n' +
    'WHERE page_bmp_id = :bitmapId';

const GET_FORM_PAGE_VERSION = 'SELECT aud_ver\n' + 'FROM :pageTable \n' + 'WHERE page_id = :pageId';

const GET_PRIMARY_FORM_DATA =
    'SELECT :columnListing FROM :formDataTable WHERE enctr_form_id = :encounterFormId';

export const getFormPages = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterForm['enctrFormId']; modelName: string },
): Promise<EncounterFormPage[]> => {
    let schemas = EncounterFormSchemaFactory.getSchemasForModel(params.modelName);
    return connection.createQueryBuilder()
        .select('page')
        .from<EncounterFormPage>(schemas.PageEntityName,'page')
        .where('page.encounterFormId = :encounterFormId', { encounterFormId: params.encounterFormId })
        .getMany();
};

export const getTagsForForm = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterFormTag['enctrFormId'] },
): Promise<EncounterFormTag[]> => {
    return await connection
        .createQueryBuilder()
        .select('encounterFormTag')
        .from(EncounterFormTag, 'encounterFormTag')
        // TODO: Inner join
        .where('encounterFormTag.enctrFormId = :enctrFormId', { enctrFormId: params.encounterFormId })
        .getMany();
};

export const getModelDataForForm = async(
    connection: Connection | EntityManager,
    params: { encounterFormId: number, modelName: string }
): Promise<EncounterFormData> => {
    let primaryFormData = await getPrimaryFormData(connection, params);
    let formBitmaps = await getBitmapDataForForm(connection, params);
    let formDetails = await getDetailDataForForm(connection, params);
    let formattedPrimaryFormData = await postProcessPrimaryFormData(connection, params.modelName, primaryFormData);
    return {
        primaryFormData: formattedPrimaryFormData,
        formBitmaps,
        formDetails: formDetails
    }
};

export const postProcessPrimaryFormData = async (
    connection: Connection | EntityManager,
    modelName: string,
    primaryFormData: {[propertyName:string]:any}
): Promise<{[propertyName:string]:any}> => {
    if(!primaryFormData) {
        return {};
    }

    let formattedData = {};
    let model = await ModelDefinitionService.getModelDefinitionByName(connection, modelName);

    for(let property of model.modelDefinitionSchema.properties) {
        let value = primaryFormData.hasOwnProperty(property.name) ? primaryFormData[property.name] : null;
        if(value != null) {
            if(property.type.typeName == 'date') {
                //console.log('- formatting date (original value: ' + JSON.stringify(value) + ')');
                if(Object.prototype.toString.call(value) === '[object Date]') {
                    value = (<Date>value).toISOString();
                }
                value = (<string>value).substr(0,10);
            }
            else if(property.type.typeName == 'time') {
                //console.log('- formatting time (original value: ' + JSON.stringify(value) + ')');
                if(Object.prototype.toString.call(value) === '[object Date]') {
                    value = (<Date>value).toISOString();
                }

                let timeRegex = /(\d{2}:\d{2}:\d{2})/;
                if(timeRegex.test(value)) {
                    value = (<string>value).match(timeRegex)[1];
                }
                else {
                    value = null;
                }
            }
            else if(['integer','smallint','bigint'].indexOf(property.type.typeName) >= 0) {
                //console.log('- formatting integer/smallint/bigint (original value: ' + JSON.stringify(value) + ')');
                value = parseInt(value);
                if(isNaN(value)) {
                    value = null;
                }
            }
            else if(property.type.typeName == 'numeric') {
                //console.log('- formatting numeric (original value: ' + JSON.stringify(value) + ')');
                value = parseFloat(value);
                if(isNaN(value)) {
                    value = null;
                }
            }
            // currently not handling timestamp
        }

        //console.log('- formatted value:  ' + JSON.stringify(value));
        formattedData[property.name] = value;
    }
    return formattedData;
}

export const getStrokesForForm = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: number; modelName: string, excludeStrokeIds?:number[]},
): Promise<EncounterFormPageStroke[]> => {
    let schemas = EncounterFormSchemaFactory.getSchemasForModel(params.modelName);
    let query = connection.createQueryBuilder()
        .select('stroke')
        .from<EncounterFormPageStroke>(schemas.StrokeEntityName,'stroke')
        .where(qb => {
            const pagesQuery = qb.subQuery()
                .select('page.pageId')
                .from<EncounterFormPage>(schemas.PageEntityName,'page')
                .where('page.encounterFormId = :encounterFormId',{encounterFormId:params.encounterFormId})
                .getQuery();
            return 'stroke.pageId IN ' + pagesQuery;
        });
    if(params.excludeStrokeIds && params.excludeStrokeIds.length > 0) {
        query.andWhere('stroke.pageStrokeId NOT IN (:...excludeStrokeIds)',{excludeStrokeIds: params.excludeStrokeIds});
    }
    return query.getMany();
};

export const getStrokesForFormByIds = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterForm['enctrFormId']; modelName: string; strokeIds: any },
): Promise<any> => {
    const strokeTable = getStrokeTableName(params.modelName);
    const pageTable = getPageTableName(params.modelName);
    const strokeSqlWithTable = GET_STROKES_FOR_FORM_BY_IDS.replace(':strokeTable', strokeTable)
        .replace(':pageTable', pageTable)
        .replace(':encounterFormId', params.encounterFormId.toString())
        .replace(':pageStrokeIds', params.strokeIds);
    const results = await connection.query(strokeSqlWithTable);
    return results;
};

export const getStrokeIdsForForm = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterForm['enctrFormId']; modelName: string },
): Promise<any> => {
    const strokeTable = getStrokeTableName(params.modelName);
    const pageTable = getPageTableName(params.modelName);
    const strokeSqlWithTable = GET_STROKE_IDS_FOR_FORM.replace(':strokeTable', strokeTable)
        .replace(':pageTable', pageTable)
        .replace(':encounterFormId', params.encounterFormId.toString());
    const results = await connection.query(strokeSqlWithTable);
    return results;
    // TODO: Find List, just return ids
};

export const getDetailDataForForm = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterForm['enctrFormId']; modelName: string },
): Promise<EncounterFormDetail[]> => {
    /*
    const detailTable = getDetailTableName(params.modelName);
    const pageTable = getPageTableName(params.modelName);
    const strokeSqlWithTable = GET_FORM_DETAIL_DATA.replace(':detailTable', detailTable)
        .replace(':encounterFormId', params.encounterFormId.toString())
        .replace(':pageTable', pageTable);
    const results = await connection.query(strokeSqlWithTable);
    return results;
    */
   let schemas = EncounterFormSchemaFactory.getSchemasForModel(params.modelName);
   let query = connection.createQueryBuilder()
       .select('detail')
       .from<EncounterFormDetail>(schemas.DetailEntityName,'detail')
       .where(qb => {
           const pagesQuery = qb.subQuery()
               .select('page.pageId')
               .from<EncounterFormPage>(schemas.PageEntityName,'page')
               .where('page.encounterFormId = :encounterFormId',{encounterFormId:params.encounterFormId})
               .getQuery();
           return 'detail.pageId IN ' + pagesQuery;
       });
    return query.getMany();
};

export const getBitmapDataForForm = async (
    connection: Connection | EntityManager,
    params: { encounterFormId: EncounterForm['enctrFormId']; modelName: string },
): Promise<EncounterFormBitmap[]> => {
    let schemas = EncounterFormSchemaFactory.getSchemasForModel(params.modelName);
    let query = connection.createQueryBuilder()
        .select('bitmap')
        .from<EncounterFormBitmap>(schemas.BitmapEntityName,'bitmap')
        .where(qb => {
            const pagesQuery = qb.subQuery()
                .select('page.pageId')
                .from<EncounterFormPage>(schemas.PageEntityName,'page')
                .where('page.encounterFormId = :encounterFormId',{encounterFormId:params.encounterFormId})
                .getQuery();
            return 'bitmap.pageId IN ' + pagesQuery;
        });
    /*if(params.excludeStrokeIds && params.excludeStrokeIds.length > 0) {
        query.andWhere('stroke.pageStrokeId NOT IN (:...excludeStrokeIds)',{excludeStrokeIds: params.excludeStrokeIds});
    }*/
    return query.getMany();
};

export const getBitmapDataById = async (
    connection: Connection | EntityManager,
    params: { pageBitmapId: EncounterForm['enctrFormId']; modelName: string },
): Promise<any> => {
    const bitmapTable = getBitmapTableName(params.modelName);
    const bmpSqlWithTable = GET_BITMAP_DATA_BY_ID.replace(':bitmapTable', bitmapTable).replace(
        ':bitmapId',
        params.pageBitmapId.toString(),
    );
    const result = await connection.query(bmpSqlWithTable);
    return result[0];
};

export const getPrimaryFormData = async (
    connection: Connection | EntityManager,
    params: {
        encounterFormId: EncounterForm['enctrFormId'];
        modelName: string;
    },
): Promise<any> => {
    const formDataTable = getPrimaryFormTable(params.modelName);
    const formDataSql = GET_PRIMARY_FORM_DATA
        .replace(':columnListing', '*')
        .replace(':formDataTable', formDataTable)
        .replace(':encounterFormId', params.encounterFormId.toString());

    const result = await connection.query(formDataSql);

    if(result && result.length > 0) {
        return result[0];
    }
    else {
        return null;
    }
};

export const getStrokesForFormPage = async (
    connection: Connection | EntityManager,
    params: { formPageId: any; modelName: string; withStrokeContent: boolean },
): Promise<any> => {
    const strokeTable = getStrokeTableName(params.modelName);
    let baseSql = null;
    if (params.withStrokeContent) baseSql = GET_STROKES_FOR_PAGE;
    else baseSql = GET_STROKES_FOR_PAGE_NO_CONTENT;

    const strokeSqlWithTable = baseSql
        .replace(':strokeTable', strokeTable.toLowerCase())
        .replace(':formPageId', params.formPageId);
    const results = await connection.query(strokeSqlWithTable);
    return results;
};

export const getFormPageVersion = async (
    connection: Connection | EntityManager,
    params: { formPageId: any; enctrFormId: EncounterForm['enctrFormId']; modelName: string },
): Promise<any> => {
    const pageTable = getPageTableName(params.modelName);
    const pageSql = GET_FORM_PAGE_VERSION.replace(':pageTable', pageTable).replace(
        ':pageId',
        params.formPageId.toString(),
    );
    const result = await connection.query(pageSql);
    return result[0];
};

export const incrementEncounterFormVersion = async(connection: Connection | EntityManager, encounterFormId:number, percentComplete:number) => {
    //console.log("Incrementing form version for form " + encounterFormId);

    if(percentComplete === null || percentComplete === undefined || isNaN(percentComplete)) {
        throw new Error('Unable to update encounter form version, invalid percent complete.');
    }

    let result = await connection.createQueryBuilder()
        .update(EncounterForm)
        .set({
            updDttm: new Date(),
            formCmpltPct: percentComplete,
            formValidInd: percentComplete === 1,
        })
        .where('enctrFormId = :encounterFormId',{encounterFormId})
        .returning(['audVer'])
        .execute();

    //console.log('Updating encounter form version.');
    //console.log(result);

    return result.raw[0].aud_ver;
}

