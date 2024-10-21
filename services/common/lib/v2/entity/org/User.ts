import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { UserRole } from './UserRole';
import { Event } from './Event';
import { TeamMembership } from './TeamMembership';

@Entity('usr', { schema: 'graphium' })
export class User {
    @PrimaryGeneratedColumn('increment', {
        name: 'usr_id',
    })
    usrId?: number;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'usr_nm',
    })
    usrNm: string;

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

    @Column('int8', {
        nullable: true,
        name: 'prvr_id',
    })
    prvrId?: number;

    @OneToMany(() => UserRole, (role) => role.user)
    roles: UserRole[];

    @OneToMany(() => Event, (event) => event.assigneeUsr)
    events?: Event[];

    @OneToOne(() => TeamMembership, (teamMembership) => teamMembership.details)
    @JoinColumn({ name: 'usr_id' })
    details?: TeamMembership;
}
