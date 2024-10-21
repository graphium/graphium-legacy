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

@Entity('fac_opt', { schema: 'graphium' })
export class FacilityOpt {
    @PrimaryGeneratedColumn('increment', {
        name: 'opt_id',
    })
    optId: number;

    @Column('int8', {
        nullable: false,
        name: 'fac_id',
    })
    facId: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'opt_nm',
    })
    optNm: string;

    @Column('text', {
        nullable: false,
        name: 'opt_val',
    })
    optVal: string;

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
