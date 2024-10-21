import {
    Index,
    Entity,
    PrimaryColumn,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    OneToMany,
    ManyToOne,
    ManyToMany,
    JoinColumn,
    JoinTable,
    RelationId,
} from 'typeorm';

import * as utils from '../../../util';

@Entity('form_defn_page', { schema: 'graphium' })
export class FormDefinitionPage {
    @PrimaryGeneratedColumn('increment', {
        name: 'form_defn_page_id',
    })
    formDefnPageId: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_id',
    })
    formDefnId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'page_nm',
    })
    pageNm?: string;

    @Column('bytea', {
        nullable: true,
        name: 'page_cntnt',
        transformer: {
            from: (value) => { return utils.formatBufferColumnToBase64(value); },
            to: (value) => { return value; }
        }
    })
    pageCntnt?: string;

    @Column('varchar', {
        name: 'page_cntnt_hash',
        nullable: true,
        length: 1000
    })
    pageCntntHash?: string;

    @Column('int2', {
        nullable: false,
        name: 'min_cnt',
    })
    minCnt?: number;

    @Column('int2', {
        nullable: true,
        name: 'max_cnt',
    })
    maxCnt?: number;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm?: Date;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'upd_dttm',
    })
    updDttm?: Date;

    @Column('int8', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    // @OneToMany(() => EncounterForm, (form) => form.encounter)
    // forms?: EncounterForm[];
}
