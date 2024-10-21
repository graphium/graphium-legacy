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
import { OrgUser } from './OrgUser';

@Entity('usr', { schema: 'graphium' })
export class User {
    @PrimaryGeneratedColumn('increment', {
        name: 'usr_id',
    })
    usrId: number;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'usr_nm',
    })
    usrNm: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'passwd',
    })
    passwd: string;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'frst_nm',
    })
    frstNm: string;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'last_nm',
    })
    lastNm: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'email_addr',
    })
    emailAddr: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'passwd_reset_cd',
    })
    passwdResetCd: string;

    @Column('timestamp with time zone', {
        nullable: true,
        name: 'passwd_reset_expr_dttm',
    })
    passwdResetExprDttm: Date;

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

    @Column('boolean', {
        nullable: false,
        default: false,
        name: 'graphium_admin_ind',
    })
    graphiumAdminInd: boolean;

    @OneToMany(() => OrgUser, (org) => org.user)
    orgs: OrgUser[];
}
