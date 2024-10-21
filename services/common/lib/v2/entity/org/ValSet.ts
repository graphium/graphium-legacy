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

@Entity('val_set', { schema: 'graphium' })
export class ValSet {
    @PrimaryGeneratedColumn('increment', {
        name: 'val_set_id',
    })
    valSetId: number;

    @Column('int4', {
        nullable: true,
        name: 'fac_id',
    })
    facId: number;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'val_set_typ',
    })
    valSetTyp: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'catg_nm',
    })
    catgNm: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'val_set_nm',
    })
    valSetNm: string;

    @Column('text', {
        nullable: false,
        name: 'val_set_desc',
    })
    valSetDesc: string;

    @Column('text', {
        nullable: false,
        name: 'attr_list',
    })
    attrList: string[];

    @Column('text', {
        nullable: true,
        name: 'dyn_sql_txt',
    })
    dynSqlTxt: string;

    @Column('boolean', {
        nullable: false,
        name: 'actv_ind',
    })
    actvInd: boolean;

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
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer: number;
}
