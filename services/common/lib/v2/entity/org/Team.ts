import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Facility } from './Facility';
import { Event } from './Event';
import { TeamMembership } from './TeamMembership';

@Entity('team', { schema: 'graphium' })
export class Team {
    @PrimaryGeneratedColumn('increment', {
        name: 'team_id',
    })
    teamId?: number;

    @Column('text', {
        nullable: false,
        name: 'team_name',
    })
    teamName?: string;

    @Column('text', {
        nullable: false,
        name: 'team_description',
    })
    teamDescription?: string;

    @Column('boolean', {
        nullable: false,
        default: true,
        name: 'actv_ind',
    })
    actvInd?: boolean;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

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

    @ManyToOne(() => Facility, (facility) => facility.team)
    @JoinColumn({ name: 'fac_id' })
    facility?: Facility;

    @OneToMany(() => Event, (event) => event.assigneeTeam)
    events?: Event[];

    @OneToMany(() => TeamMembership, (teamMembership) => teamMembership.users)
    users?: TeamMembership[];
}
