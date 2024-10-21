import {
    Entity,
    PrimaryGeneratedColumn,
    Column
} from 'typeorm';

@Entity('model_defn', { schema: 'graphium' })
export class ModelDefinitionHistory {
    @PrimaryGeneratedColumn('increment', {
        name: 'model_defn_hist_id',
    })
    modelDefnHistId: number;

    @Column('int4', {
        nullable: false,
        name: 'model_defn_id',
    })
    modelDefnId: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'model_defn_nm',
    })
    modelDefnNm: string;

    @Column('text', {
        nullable: false,
        name: 'model_defn_desc',
    })
    modelDefnDesc: string;

    @Column('int4', {
        nullable: false,
        name: 'model_defn_ver',
    })
    modelDefnVer: number;

    @Column('text', {
        nullable: false,
        name: 'model_defn_cntnt',
    })
    modelDefnCntnt: string;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm: Date;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'upd_dttm',
    })
    updDttm: Date;

    @Column('int4', {
        nullable: true,
        default: 1,
        name: 'aud_ver',
    })
    audVer: number;
}