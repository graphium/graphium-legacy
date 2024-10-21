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
        name: 'org_id',
    })
    orgId: number;

    @Column('integer', {
        nullable: true,
        name: 'usr_id',
    })
    usrId: number;

    @Column('integer', {
        nullable: true,
        name: 'invite_id',
    })
    inviteId: number;

    @Column('integer', {
        nullable: true,
        name: 'opt_id',
    })
    optId: number;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm: Date;
}
