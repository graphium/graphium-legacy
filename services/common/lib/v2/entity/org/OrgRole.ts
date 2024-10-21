import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { UserRole } from './UserRole';

@Entity('org_role', { schema: 'graphium' })
export class OrgRole {
    @PrimaryGeneratedColumn('increment', {
        name: 'role_id',
    })
    roleId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'role_nm',
    })
    roleNm: string;

    @Column('text', {
        nullable: false,
        name: 'role_desc',
    })
    roleDesc: string;

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
        nullable: true,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    @OneToOne(() => UserRole, (role) => role.details)
    @JoinColumn({ name: 'role_id' })
    details?: UserRole;
}
