import { ModelPropertyDefinitionSchema } from '../../model/model/ModelPropertyDefinitionSchema';
import { ModelPropertyUpdate } from '../../model/model/ModelPropertyUpdate';
import * as EncounterFormSchemaFactory from '../entity/org/EncounterFormSchemaFactory';
import { Connection, EntityManager, QueryRunner } from 'typeorm';
import { TableNameUtil } from '../../util/TableNameUtil';
import * as EncounterService from './EncounterService';
import * as FormService from './FormService';
import * as jsonpointer from 'jsonpointer';
import { RepeatableBitmapUpdate } from '../../model/model/RepeatableBitmapUpdate';

export class ModelPropertyUpdateService {

    private queryRunner: QueryRunner;

    public async updateModel(
        orgConnection: Connection,
        encounterFormId: number,
        propertyUpdates: ModelPropertyUpdate[],
        skipAuditVersionUpdate: boolean = false,
        log: any = null,
    ): Promise<number> {
        //console.log('Creating query runner.');
        this.queryRunner = orgConnection.createQueryRunner();
        //console.log('Creating transaction.');
        this.queryRunner.startTransaction();
        var error: Error;
        var auditVersion: number;
        try {
            //console.log('Getting encounter form with model definition...');
            let encounterForm = await EncounterService.getEncounterForm(this.queryRunner.manager, encounterFormId, {
                withModelDefinitionContent: true
            });

            await encounterForm.formDefinitionHistory.modelDefinition.parseModelDefinitionContent();
            let modelDefinition = encounterForm.formDefinitionHistory.modelDefinition;

            if (!encounterForm) {
                throw new Error('Unable to find encounter form (' + encounterFormId + ')');
            }
            
            for(let propertyUpdate of propertyUpdates) {

                let modelName = modelDefinition.modelDefinitionSchema.name;

                //console.log('Getting property type for property: ' + propertyUpdate.propertyName);
                let propertyDefinition = modelDefinition.modelDefinitionSchema.getPropertyByName(propertyUpdate.propertyName);
                //console.log(propertyDefinition);

                if(!propertyDefinition) {
                    throw new Error('Property named ' + propertyUpdate.propertyName + ' does not exist on ' + modelName + ' model.');
                }

                if (propertyDefinition.type.typeName == 'bitmap') {
                    if(log) log.logInfo('GEN_BMP_UPDATE','Generating update for bitmap repeatable field.');
                    await this.generateBitmapInsert(
                        modelName, 
                        encounterFormId, 
                        propertyDefinition,
                        propertyUpdate);
                } else if (propertyDefinition.isRepeatable) {
                    if(log) log.logInfo('GEN_REP_UPDATE', 'Generating update for repeatable field.');
                    await this.generateRepeatableInsert(
                        modelName, 
                        encounterFormId, 
                        propertyDefinition, 
                        propertyUpdate);
                } else {
                    if(log) log.logInfo('GEN_PRIM_FORM_UPDATE', 'Generating update for primary field.');
                    await this.generatePrimaryFormDataUpdate(
                        this.queryRunner.manager,
                        modelName,
                        encounterFormId,
                        propertyDefinition,
                        propertyUpdate,
                    );
                }
            }

            if(!skipAuditVersionUpdate) {
                //console.log('Updating version and update date time on encounter form.');
                auditVersion = await FormService.incrementEncounterFormVersion(this.queryRunner.manager, encounterFormId, propertyUpdates[propertyUpdates.length - 1].percentComplete);
            }
            else {
                //console.log('Skipping encounter form version update.');
            }

            this.queryRunner.commitTransaction();
        } catch (err) {
            this.queryRunner.rollbackTransaction();
            error = err;
        } finally {
            this.queryRunner.release();
        }
        if (error) {
            throw error;
        }
        return auditVersion;
    }

    private async checkForExistingDetail(modelName: string, propertyUpdate: ModelPropertyUpdate): Promise<boolean> {
        /*
        Legacy query for checking if repeatable property (bitmal or discrete) exists.

        private static readonly REPEATABLE_EXISTS_SQL: string =
        'SELECT COUNT(1) as row_cnt FROM :tableName \n' +
        'WHERE page_id = :pageId\n' +
        'AND prop_nm = :propertyName\n' +
        'AND prop_seq = :propertySequence';
        */
       
        let tableName = TableNameUtil.getDetailTableName(modelName);
        let result = await this.queryRunner.manager
            .createQueryBuilder()
            .select('COUNT(1)', 'row_cnt')
            .addFrom(tableName, 'model_table')
            .where('page_id = :pageId', { pageId: propertyUpdate.pageId })
            .andWhere('prop_nm = :propertyName', { propertyName: propertyUpdate.propertyName })
            .andWhere('prop_seq = :propertySequence', { propertySequence: propertyUpdate.propertySequence })
            .execute();

        return result && result.length > 0 ? result[0].row_cnt !== '0' : false;
    }

    private async checkForExistingBitmap(modelName: string, propertyUpdate: ModelPropertyUpdate): Promise<boolean> {
        let tableName = TableNameUtil.getBitmapTableName(modelName);
        let result = await this.queryRunner.manager
            .createQueryBuilder()
            .select('COUNT(1)', 'row_cnt')
            .addFrom(tableName, 'model_table')
            .where('page_id = :pageId', { pageId: propertyUpdate.pageId })
            .andWhere('prop_nm = :propertyName', { propertyName: propertyUpdate.propertyName })
            .andWhere('prop_seq = :propertySequence', { propertySequence: propertyUpdate.propertySequence })
            .execute();

        return result && result.length > 0 ? result[0].row_cnt !== '0' : false;
    }

    private async deleteDetailRow(modelName:string, propertyUpdate: ModelPropertyUpdate) {
        /*
            Legacy query to delete detail.

            private static REPEATABLE_DELETE_SQL: string =
                'DELETE FROM :tableName \n' +
                'WHERE page_id = :pageId\n' +
                'AND prop_nm = :propertyName\n' +
                'AND prop_seq = :propertySequence';
        */
        let schemas = EncounterFormSchemaFactory.getSchemasForModel(modelName);
        let deleteResult = await this.queryRunner.manager.createQueryBuilder()
            .delete()
            .from(schemas.DetailEntity)
            .where('pageId = :pageId', {pageId: propertyUpdate.pageId})
            .andWhere('propertyName = :propertyName', {propertyName: propertyUpdate.propertyName})
            .andWhere('propertySequence = :propertySequence', {propertySequence: propertyUpdate.propertySequence})
            .execute();
    }

    private async deleteBitmapRow(modelName:string, propertyUpdate: ModelPropertyUpdate) {
        let schemas = EncounterFormSchemaFactory.getSchemasForModel(modelName);
        let deleteResult = await this.queryRunner.manager.createQueryBuilder()
            .delete()
            .from(schemas.BitmapEntity)
            .where('pageId = :pageId', {pageId: propertyUpdate.pageId})
            .andWhere('propertyName = :propertyName', {propertyName: propertyUpdate.propertyName})
            .andWhere('propertySequence = :propertySequence', {propertySequence: propertyUpdate.propertySequence})
            .execute();
    }

   protected async generateRepeatableInsert(
    modelName: string,
    encounterFormId: number,
    propertyDefinition: ModelPropertyDefinitionSchema,
    propertyUpdate: ModelPropertyUpdate,
): Promise<any> {

        if(propertyUpdate.fieldValue === null) {
            //console.log('Property update is null, deleting property.');
            await this.deleteDetailRow(modelName, propertyUpdate);
            return;
        }

        //Check for existing row
        var hasExistingRow = await this.checkForExistingDetail(modelName, propertyUpdate);
        //console.log('Has existing detail row: ' + hasExistingRow);
        /*
        Legacy queries that were used to update/insert repeatable values.
        private static REPEATABLE_INSERT_SQL: string =
            'INSERT INTO :formDetailTable \n' +
            '(page_id, prop_nm, prop_seq, prop_val, ins_dttm, upd_dttm, aud_ver)\n' +
            'VALUES \n' +
            '(:pageId, :propertyName, :propertySequence, :propertyValue, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)';

        private static REPEATABLE_UPDATE_SQL: string =
            'UPDATE :formDetailTable \n' +
            'SET prop_val = :propertyValue\n' +
            'WHERE page_id = :pageId\n' +
            'AND prop_nm = :propertyName\n' +
            'AND prop_seq = :propertySequence';
        */

        // TODO Validate that it is a valid repeatable update (includes sequence number, in correct format, etc.)
        
        let schemas = EncounterFormSchemaFactory.getSchemasForModel(modelName);
        if(hasExistingRow) {
            //console.log('Creating update query.');
            let fieldValue = propertyUpdate.fieldValue.toString();
            let updateResult = await this.queryRunner.manager
                .createQueryBuilder()
                .update(schemas.DetailEntity)
                .set({
                    propertyValue: fieldValue
                })
                .where('pageId = :pageId AND propertyName = :propertyName AND propertySequence = :propertySequence', 
                        {   
                            pageId: propertyUpdate.pageId, 
                            propertyName: propertyUpdate.propertyName, 
                            propertySequence: propertyUpdate.propertySequence 
                        })
                .execute();
            //console.log('Detail updated.');
            //console.log(updateResult);
        }
        else {
            //console.log('Creating insert query.');
            let insertResult = await this.queryRunner.manager.createQueryBuilder()
                .insert()
                .into(schemas.DetailEntity)
                .values({
                    pageId: propertyUpdate.pageId,
                    propertyName: propertyUpdate.propertyName,
                    propertySequence: propertyUpdate.propertySequence,
                    propertyValue: propertyUpdate.fieldValue.toString(),
                    createTime: () => 'CURRENT_TIMESTAMP',
                    updateTime: () => 'CURRENT_TIMESTAMP',
                    auditVersion: 1
                })
                .execute();
            //console.log('Detail inserted.');
            //console.log(insertResult);
        }
    }
    
    private async generateBitmapInsert(modelName: string,
        encounterFormId: number,
        propertyDefinition: ModelPropertyDefinitionSchema,
        propertyUpdate: ModelPropertyUpdate,
        ): Promise<any> {

        if(propertyUpdate.fieldValue === null) {
            await this.deleteBitmapRow(modelName, propertyUpdate);
            return;
        }

        let hasExistingBitmap = await this.checkForExistingBitmap(modelName, propertyUpdate);

        /*
            Legacy queries for updating/inserting bitmap repeatable properties.

            private static BITMAP_INSERT_SQL: string =
                'INSERT INTO :bitmapTable (page_id,\n' +
                'prop_nm,\n' +
                'prop_seq,\n' +
                'width,\n' +
                'height,\n' +
                'scale,\n' +
                'encod_typ,\n' +
                'bmp_cntnt,\n' +
                'ins_dttm,\n' +
                'upd_dttm,\n' +
                'aud_ver) \n ' +
                'VALUES (:pageId, :propertyName, :propertySequence, :width, :height, :scale, :encodingType, :bitmapContent, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)';

            private static BITMAP_UPDATE_SQL: string =
                'UPDATE :bitmapTable \n' +
                'SET width = :width,\n' +
                'height = :height,\n' +
                'scale = :scale,\n' +
                'encod_typ = :encodingType,\n' +
                'bmp_cntnt = :bitmapContent \n' +
                'WHERE page_id = :pageId\n' +
                'AND prop_nm = :propertyName\n' +
                'AND prop_seq = :propertySequence';
        */
        let schemas = EncounterFormSchemaFactory.getSchemasForModel(modelName);
        let bitmapUpdate = <RepeatableBitmapUpdate>propertyUpdate.fieldValue;

        if(hasExistingBitmap === true) {
            //console.log('Creating bitmap update query.');
            let updateResult = await this.queryRunner.manager
                .createQueryBuilder()
                .update(schemas.BitmapEntity)
                .set({
                    width: bitmapUpdate.width,
                    height: bitmapUpdate.height,
                    scale: bitmapUpdate.scale,
                    encodingType: bitmapUpdate.encodeType,
                    bitmapContent: bitmapUpdate.bitmapContent
                })
                .where('pageId = :pageId AND propertyName = :propertyName AND propertySequence = :propertySequence', 
                        {   
                            pageId: propertyUpdate.pageId, 
                            propertyName: propertyUpdate.propertyName, 
                            propertySequence: propertyUpdate.propertySequence 
                        })
                .execute();
            //console.log('Bitmap detail updated.');
            //console.log(updateResult);
        }
        else {
            //console.log('Creating bitmap insert query.');
            let insertResult = await this.queryRunner.manager.createQueryBuilder()
                .insert()
                .into(schemas.BitmapEntity)
                .values({
                    pageId: propertyUpdate.pageId,
                    propertyName: propertyUpdate.propertyName,
                    propertySequence: propertyUpdate.propertySequence,
                    width: bitmapUpdate.width,
                    height: bitmapUpdate.height,
                    scale: bitmapUpdate.scale,
                    encodingType: bitmapUpdate.encodeType,
                    bitmapContent: bitmapUpdate.bitmapContent,
                    createTime: () => 'CURRENT_TIMESTAMP',
                    updateTime: () => 'CURRENT_TIMESTAMP',
                    auditVersion: 1
                })
                .execute();
            //console.log('Bitmap inserted.');
            //console.log(insertResult);
        }
    }

    protected validateJsonPropertyType(propertyDefinition: ModelPropertyDefinitionSchema, propertyUpdate:ModelPropertyUpdate) {
        if(propertyUpdate.fieldValue === null) {
            return true;
        }

        if(propertyUpdate.fieldValue === undefined) {
            throw new Error('Must define a property value or null when udpating a JSON property.');
        }

        if(propertyDefinition.type.typeName == 'jsonObject' || propertyDefinition.type.typeName == 'jsonArray') {
            switch(propertyUpdate.jsonPropertyType) {
                case 'STRING':
                    if(typeof(propertyUpdate.fieldValue) !== 'string') {
                        throw new Error('JSON STRING property must be a string.')
                    }
                    break;
                case 'NUMBER':
                    if(typeof(propertyUpdate.fieldValue) !== 'number') {
                        throw new Error('JSON NUMBER property must be a number.')
                    }
                    break;
                case 'DATE':
                    let validDateRegex = /^((19|20)\d\d)(-(\d{2}))(-(\d{2}))$/;
                    let validDate = typeof(propertyUpdate.fieldValue) === 'string' && validDateRegex.test(propertyUpdate.fieldValue);
                    if(!validDate) {
                        throw new Error('JSON DATE property must be a string in YYYY-MM-DD format.');
                    }
                    break;
                case 'TIME':
                    let validTimeRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
                    let validTime = typeof(propertyUpdate.fieldValue) === 'string' && validTimeRegex.test(propertyUpdate.fieldValue);
                    if(!validTime) {
                        throw new Error('JSON TIME property must be a string in HH:mm:dd format.');
                    }
                    break;
                case 'TIMESTAMP_ISO_WITH_TZ':
                    let validIsoRegex = /^((19|20)\d\d)(-(\d{2}))(-(\d{2}))(T(\d{2}):(\d{2})(:(\d{2}))(([\+\-]{1}\d{2}:\d{2})))$/;
                    let validIso = typeof(propertyUpdate.fieldValue) === 'string' && validIsoRegex.test(propertyUpdate.fieldValue);
                    if(!validIso) {
                        throw new Error('Json property must be a string in ISO format with timezone.');
                    }
                    break;
                case 'TIMESTAMP_UNIX':
                    if(typeof(propertyUpdate.fieldValue) !== 'number') {
                        throw new Error('JSON TIMESTAMP_UNIX property must be a number.')
                    }

                    if (propertyUpdate.fieldValue % 1 !== 0) {
                        throw new Error('JSON TIMESTAMP_UNIX property must be an integer, not a floating point number.');
                    }
                    break;
                default:
                    throw new Error('Invalid jsonPropertyType in model update: ' + propertyUpdate.jsonPropertyType);
            }
        }
        else {
            throw new Error('Unable to validate property value, not a valid JSON type.')
        }
    }

    // TODO: this is begging for some good unit testing.
    protected async generatePrimaryFormDataUpdate(
        connection: Connection | EntityManager,
        modelName: string,
        encounterFormId: number,
        propertyDefinition: ModelPropertyDefinitionSchema,
        propertyUpdate: ModelPropertyUpdate,
    ): Promise<any> {
        let propertyValue: any;
        let propertyType: string = propertyDefinition.type.typeName;
        //console.log('Generating update: ');
        //console.log(propertyUpdate);
        if (propertyUpdate.fieldValue === undefined) {
            throw new Error('Cannot update model property, field value is not defined.');
        } else if (propertyUpdate.fieldValue === null && propertyType !== 'jsonArray' && propertyType !== 'jsonObject') {
            //console.log('Setting property to null.');
            propertyValue = null;
        } else if (propertyType == 'date') {
            if (
                typeof propertyUpdate.fieldValue !== 'string' ||
                //!/^([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/.test(propertyUpdate.fieldValue)
                // This was too restrictive, it turns out that the mobile app is sometimes sending 
                // a date of 0001-01-01 while we were looking for only dates that start with 1 or 2 in
                // the year.
                !/^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/.test(propertyUpdate.fieldValue)
            ) {
                throw new Error('Date property value must be a string the format YYYY-MM-DD.');
            }
            propertyValue = propertyUpdate.fieldValue;
        } else if (propertyType == 'time') {
            if (
                typeof propertyUpdate.fieldValue !== 'string' ||
                !/^(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])$/.test(propertyUpdate.fieldValue)
            ) {
                throw new Error('Time property value must be a string the format HH:mm:ss.');
            }
            propertyValue = propertyUpdate.fieldValue;
        } else if (propertyType == 'timestamp') {
            //console.log('We do not currently support the timestamp type: ' + propertyUpdate.fieldValue);
            //TODO: Add additional validation of incoming data.
            propertyValue = propertyUpdate.fieldValue;
        } else if (['text', 'varchar'].indexOf(propertyType) >= 0) {
            if (typeof propertyUpdate.fieldValue !== 'string') {
                throw new Error('Field value must be a string to set a property of type ' + propertyType);
            }
            propertyValue = propertyUpdate.fieldValue;
        } else if (['integer', 'smallint', 'bigint'].indexOf(propertyType) >= 0) {
            if (typeof propertyUpdate.fieldValue == 'string') {
                // We first parse it as a float to determine if the user is trying to pass a
                // float value into an int field. If so we will reject it. We will only accept
                // integers.
                let floatValue = parseFloat(propertyUpdate.fieldValue);

                // First if the string isn't even a number then we reject it.
                if (Number.isNaN(floatValue)) {
                    throw new Error('Field value must be an integer value to set a property of type ' + propertyType);
                }

                if (floatValue % 1 !== 0) {
                    throw new Error('Cannot set an integer, smallint or bigint property with a float value.');
                }

                // We know it is a number and not a float, so we parse it as an integer and store that value.
                let intValue = parseInt(propertyUpdate.fieldValue);
                propertyValue = intValue;
            } else if (typeof propertyUpdate.fieldValue == 'number' && Number.isInteger(propertyUpdate.fieldValue)) {
                propertyValue = propertyUpdate.fieldValue;
            } else {
                throw new Error('Unable to set int, bigint or smallint property type, invalid field value.');
            }
        } else if (propertyType == 'numeric') {
            if (typeof propertyUpdate.fieldValue == 'string') {
                let floatValue = parseFloat(propertyUpdate.fieldValue);
                if (Number.isNaN(floatValue)) {
                    throw new Error('Field value must be an float value to set a property of type ' + propertyType);
                }
                propertyValue = floatValue;
            } else if (typeof propertyUpdate.fieldValue == 'number') {
                propertyValue = propertyUpdate.fieldValue;
            } else {
                throw new Error('Unable to set numeric property type, invalid field value.');
            }
        } else if (propertyType == 'boolean') {
            if (typeof propertyUpdate.fieldValue == 'boolean') {
                propertyValue = propertyUpdate.fieldValue;
            } else if (typeof propertyUpdate.fieldValue == 'string') {
                if (propertyValue.fieldValue === 'true') {
                    propertyValue = true;
                } else if (propertyUpdate.fieldValue === 'false') {
                    propertyValue = false;
                } else {
                    throw new Error(
                        'Unable to set boolean property using invalid string value: ' + propertyUpdate.fieldValue,
                    );
                }
            } else {
                throw new Error('Unable to set boolean property, must specify a string or boolean as the field value.');
            }
        } else if(propertyType == "jsonObject") {
            let primaryFormData = await FormService.getPrimaryFormData(connection, { encounterFormId, modelName });
            let currentValue = primaryFormData != null ? primaryFormData[propertyUpdate.propertyName] : null;
            //console.log('Found current jsonObject value: ' + JSON.stringify(currentValue));

            if(currentValue == "" || currentValue == null) {
                //console.log('Current value is empty string or null, setting current value to empty object.');
                currentValue = {};
            }
            else if(typeof(currentValue) === 'string') {
                //console.log('Found current value, parsing.');
                currentValue = JSON.parse(currentValue);
                //console.log(currentValue);
                if(typeof(currentValue) !== 'object' || Array.isArray(currentValue)) {
                    throw new Error('Current database value is not a valid json object.');
                }
            }
            
            this.validateJsonPropertyType(propertyDefinition, propertyUpdate);

            //console.log('Setting json value on object...');
            jsonpointer.set(currentValue, propertyUpdate.jsonPointer, propertyUpdate.fieldValue);
            //console.log(currentValue);

            propertyValue = JSON.stringify(currentValue);
        }
        else if(propertyType == "jsonArray")
        {
            //console.log('Generating update for jsonArray property type.');
            let primaryFormData = await FormService.getPrimaryFormData(connection, { encounterFormId, modelName });
            let currentArray = primaryFormData != null ? primaryFormData[propertyUpdate.propertyName] : null;
            //console.log('Found current jsonArray value: ' + JSON.stringify(currentArray));

            if(typeof(currentArray) === 'string') {
                try {
                    currentArray = JSON.parse(currentArray);
                }
                catch(error) {
                    currentArray = [];
                }
            }

            if(currentArray == null || !Array.isArray(currentArray)) {
                //console.log('Current value is null or not an array, setting current value to empty array.');
                currentArray = [];
            }
            
            let currentValue = {};
            if(propertyUpdate.jsonIndex < currentArray.length) {
                currentValue = currentArray[propertyUpdate.jsonIndex];

                if(currentValue === null || typeof currentValue !== 'object') {
                    currentValue = {};
                }
            }

            this.validateJsonPropertyType(propertyDefinition, propertyUpdate);

            //console.log('Setting json value on object and updating array...');
            jsonpointer.set(currentValue, propertyUpdate.jsonPointer, propertyUpdate.fieldValue);
            currentArray[propertyUpdate.jsonIndex] = currentValue;
            //console.log(currentArray);

            propertyValue = JSON.stringify(currentArray);
        } else {
            throw new Error('Unable to set property, unknown property type: ' + propertyType);
        }

        //String updateSql =  PRIMARY_FORM_UPDATE_SQL.replace(":primaryFormTable", TableNameUtil.getPrimaryFormTable(modelName))
        //        .replace(":propertyName", propertyUpdate.getPropertyName().toLowerCase());
        /*
        UPDATE :primaryFormTable \n" +
            "set :propertyName = :propertyValue\n" +
            "WHERE enctr_form_id = :encounterFormId
        */
        let updates = {};
        updates[propertyUpdate.propertyName] = propertyValue;

        let tableName = TableNameUtil.getPrimaryFormTable(modelName);
        let result = await this.queryRunner.manager
            .createQueryBuilder()
            .update(tableName)
            .set(updates)
            .where('enctr_form_id = :encounterFormId', { encounterFormId })
            .execute();
        return result;
    }
}
