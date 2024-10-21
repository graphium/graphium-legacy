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

@Entity('val_set_dtl', { schema: 'graphium' })
export class ValSetDetail {
    @PrimaryGeneratedColumn('increment', {
        name: 'val_set_dtl_id',
    })
    valSetDtlId: number;

    @Column('int4', {
        nullable: false,
        name: 'val_set_id',
    })
    valSetId: string;

    @Column('hstore', {
        nullable: false,
        name: 'val_list',
    })
    valList: string;

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
