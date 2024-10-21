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

@Entity('invite', { schema: 'graphium' })
export class Invite {
    @PrimaryGeneratedColumn('increment', {
        name: 'invite_id',
    })
    inviteId: number;

    @Column('int8', {
        nullable: false,
        name: 'org_id',
    })
    orgId: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'email_addr',
    })
    emailAddr: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'reg_cd',
    })
    regCd: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'invite_key_cd',
    })
    inviteKeyCd: string;

    @Column('timestamp with time zone', {
        nullable: true,
        name: 'invite_key_expr_dttm',
    })
    inviteKeyExprDttm: Date;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        default: 'PENDING',
        name: 'invite_stat_cd',
    })
    inviteStatCd: string;

    @Column('int8', {
        nullable: true,
        name: 'role_id_list',
    })
    roleIdList: number[];

    @Column('int8', {
        nullable: true,
        name: 'usr_id',
    })
    usrId: number;

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

    @Column('int8', {
        nullable: true,
        name: 'fac_id_list',
    })
    facIdList: number[];
}
