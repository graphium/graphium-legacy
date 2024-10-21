import { Entity, PrimaryColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Team } from './Team';
import { User } from './User';

@Entity('team_membership', { schema: 'graphium' })
export class TeamMembership {
    @PrimaryColumn('int8', {
        nullable: false,
        name: 'team_id',
    })
    teamId?: number;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

    @PrimaryColumn('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId?: number;

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

    @Column('int8', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    @ManyToOne(() => Team, (team) => team.users)
    @JoinColumn({ name: 'team_id' })
    users?: Team[];

    @OneToOne(() => User, (user) => user.details)
    details?: User;
}
