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

@Entity('fac_usr', { schema: 'graphium' })
export class FacilityUser {
    @PrimaryColumn('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId: number;

    @PrimaryColumn('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId: number;

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
    insDttm?: Date;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'upd_dttm',
    })
    updDttm?: Date;

    @Column('int4', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;
}
