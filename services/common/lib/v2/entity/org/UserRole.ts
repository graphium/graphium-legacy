import { Entity, PrimaryColumn, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { OrgRole } from './OrgRole';
import { User } from './User';

@Entity('usr_role', { schema: 'graphium' })
export class UserRole {
    @PrimaryColumn('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId: number;

    @PrimaryColumn('int4', {
        nullable: false,
        name: 'role_id',
    })
    roleId: number;

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

    @ManyToOne(() => User, (user) => user.roles)
    @JoinColumn({ name: 'usr_id' })
    user?: User[];

    @OneToOne(() => OrgRole, (role) => role.details)
    details?: OrgRole;
}
