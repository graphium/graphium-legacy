import { EntitySchema } from 'typeorm';
import { EncounterFormPage } from './EncounterFormPage';
import { EncounterFormPageStroke } from './EncounterFormPageStroke';
import * as utils from '../../../util';
import { EncounterFormBitmap } from './EncounterFormBitmap';
import { EncounterFormDetail } from './EncounterFormDetail';
import { TableNameUtil } from '../../../util/TableNameUtil';

export const getSchemasForModel = ( modelName: string ) => {

    let PageEntityName = TableNameUtil.getPageTableName(modelName);
    let PageEntity = new EntitySchema<EncounterFormPage>({
        name: PageEntityName,
        columns: {
            pageId: {
                type: 'int8',
                nullable: false,
                name: 'page_id',
                primary: true
            },
            encounterFormId: {
                type: 'int8',
                nullable: false,
                name: 'enctr_form_id'
            },
            pageName: {
                type: 'varchar',
                nullable: false,
                name: 'page_nm'
            },
            pageNumber: {
                type: 'int2',
                nullable: false,
                name: 'page_no'
            },
            createTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'ins_dttm'
            },
            updateTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'upd_dttm'
            },
            auditVersion: {
                type: 'int4',
                nullable: false,
                name: 'aud_ver'
            }
        },
    });

    let StrokeEntityName = TableNameUtil.getStrokeTableName(modelName);
    let StrokeEntity = new EntitySchema<EncounterFormPageStroke>({
        name: StrokeEntityName,
        columns: {
            pageStrokeId: {
                name: 'page_stroke_id',
                type: 'int8',
                nullable: false,
                primary: true
            },
            pageId: {
                name: 'page_id',
                type: 'int8',
                nullable: false
            },
            x: {
                name: 'x',
                type: 'numeric',
                nullable: false
            },
            y: {
                name: 'y',
                type: 'numeric',
                nullable: false
            },
            width: {
                name: 'width',
                type: 'numeric',
                nullable: false
            },
            height: {
                name: 'height',
                type: 'numeric',
                nullable: false
            },
            scale: {
                name: 'scale',
                type: 'numeric',
                nullable: false
            },
            encodeType: {
                name: 'encod_typ',
                type: 'varchar',
                nullable: false
            },
            strokeContent: {
                name: 'stroke_cntnt',
                type: 'bytea',
                nullable: false,
                transformer: {
                    from: (value) => { return utils.formatBufferColumnToBase64(value); },
                    to: (value) => { return utils.formatBase64ToBufferColumn(value); }
                }
            },
            createTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'ins_dttm'
            }
        }
    });

    let BitmapEntityName:string = TableNameUtil.getBitmapTableName(modelName);
    let BitmapEntity = new EntitySchema<EncounterFormBitmap>({
        name: BitmapEntityName,
        columns: {
            pageBitmapId: {
                name: 'page_bmp_id',
                type: 'int8',
                nullable: false,
                primary: true
            },
            pageId: {
                name: 'page_id',
                type: 'int8',
                nullable: false
            },
            propertyName: {
                name: 'prop_nm',
                type: 'varchar',
                nullable: false
            },
            propertySequence: {
                name: 'prop_seq',
                type: 'int4',
                nullable: false
            },
            width: {
                name: 'width',
                type: 'numeric',
                nullable: false
            },
            height: {
                name: 'height',
                type: 'numeric',
                nullable: false
            },
            scale: {
                name: 'scale',
                type: 'numeric',
                nullable: false
            },
            encodingType: {
                name: 'encod_typ',
                type: 'varchar',
                nullable: false
            },
            bitmapContent: {
                name: 'bmp_cntnt',
                type: 'bytea',
                nullable: false,
                transformer: {
                    from: (value) => { return utils.formatBufferColumnToBase64(value); },
                    to: (value) => { return utils.formatBase64ToBufferColumn(value); }
                }
            },
            createTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'ins_dttm'
            },
            updateTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'upd_dttm'
            },
            auditVersion: {
                type: 'int4',
                name:'aud_ver',
                nullable: false
            }
        }
    });

    let DetailEntityName:string = TableNameUtil.getDetailTableName(modelName);
    let DetailEntity = new EntitySchema<EncounterFormDetail>({
        name: DetailEntityName,
        columns: {
            pageDetailId: {
                name: 'page_dtl_id',
                type: 'int8',
                nullable: false,
                primary: true
            },
            pageId: {
                name: 'page_id',
                type: 'int8',
                nullable: false
            },
            propertyName: {
                name: 'prop_nm',
                type: 'varchar',
                nullable: false
            },
            propertySequence: {
                name: 'prop_seq',
                type: 'int4',
                nullable: false
            },
            propertyValue: {
                name: 'prop_val',
                type: 'varchar',
                nullable: false
            },
            createTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'ins_dttm'
            },
            updateTime: {
                type: 'timestamptz',
                nullable: false,
                name: 'upd_dttm'
            },
            auditVersion: {
                type: 'int4',
                name:'aud_ver',
                nullable: false
            }
        }
    });

    return { 
        PageEntity, PageEntityName, 
        StrokeEntity, StrokeEntityName, 
        BitmapEntity, BitmapEntityName, 
        DetailEntity, DetailEntityName 
    };
}