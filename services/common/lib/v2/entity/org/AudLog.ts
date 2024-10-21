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

@Entity('aud_log', { schema: 'graphium' })
export class AudLog {
    @Column('integer', {
        nullable: false,
        primary: true,
        name: 'aud_log_id',
    })
    audLogId: number;

    @Column('integer', {
        nullable: false,
        name: 'aud_usr_id',
    })
    audUsrId: string;

    @Column('integer', {
        nullable: false,
        name: 'aud_typ_id',
    })
    audTypId: string;

    @Column('text', {
        nullable: true,
        name: 'aud_evnt_desc',
    })
    audEvntDesc: string;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'aud_evnt_dttm',
    })
    audEvntDttm: Date;

    @Column('integer', {
        nullable: true,
        name: 'usr_id',
    })
    usrId: number;

    @Column('integer', {
        nullable: true,
        name: 'fac_id',
    })
    facId: number;

    @Column('integer', {
        nullable: true,
        name: 'enctr_id',
    })
    enctrId: number;

    @Column('integer', {
        nullable: true,
        name: 'tag_id',
    })
    tagId: number;

    @Column('integer', {
        nullable: true,
        name: 'form_def_id',
    })
    formDefId: number;

    @Column('integer', {
        nullable: true,
        name: 'model_def_id',
    })
    modelDefId: number;

    @Column('integer', {
        nullable: true,
        name: 'search_def_id',
    })
    searchDefId: number;

    @Column('integer', {
        nullable: true,
        name: 'rpt_def_id',
    })
    rptDefId: number;

    @Column('integer', {
        nullable: true,
        name: 'enctr_form_id',
    })
    enctrFormId: number;

    @Column('integer', {
        nullable: true,
        name: 'role_id',
    })
    roleId: number;

    @Column('integer', {
        nullable: true,
        name: 'org_id',
    })
    orgId: number;

    @Column('integer', {
        nullable: true,
        name: 'prvr_id',
    })
    prvrId: number;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm: Date;

    @Column('integer', {
        nullable: true,
        name: 'qcdr_metric_id',
    })
    qcdrMetricId: number;
}
