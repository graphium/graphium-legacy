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

@Entity('usr_pref', { schema: 'graphium' })
export class UserPreference {
    @PrimaryGeneratedColumn('increment', {
        name: 'usr_pref_id',
    })
    usrPrefId: number;

    @Column('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'catg_nm',
    })
    catgNm: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'pref_nm',
    })
    prefNm: string;

    @Column('text', {
        nullable: false,
        name: 'pref_val',
    })
    prefVal: string;

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
