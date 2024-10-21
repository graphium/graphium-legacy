import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { EventState } from './EventState';
import { User } from './User';
import { Team } from './Team';
import { Patient } from './Patient';
import { Facility } from './Facility';
import { Encounter } from './Encounter';

@Entity('event', { schema: 'graphium' })
export class Event {
    @PrimaryGeneratedColumn('increment', {
        name: 'event_id',
    })
    eventId?: number;

    @Column('text', {
        nullable: false,
        name: 'event_class_code',
    })
    eventClassCode?: string;

    @Column('text', {
        nullable: false,
        name: 'event_name',
    })
    eventName?: string;

    @Column('text', {
        nullable: true,
        name: 'event_description',
    })
    eventDescription?: string;

    @Column('text', {
        nullable: true,
        name: 'event_location',
    })
    eventLocation?: string;

    @Column('text', {
        nullable: false,
        name: 'event_type_code',
    })
    eventTypeCode?: string;

    @Column('int4', {
        nullable: false,
        name: 'event_state_id',
    })
    eventStateId?: number;

    @Column('jsonb', {
        nullable: false,
        name: 'event_state_transitions',
    })
    eventStateTransitions?: any[];

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

    @Column('date', {
        nullable: false,
        name: 'event_start_date',
    })
    eventStartDate?: string;

    @Column('time', {
        nullable: false,
        name: 'event_start_time',
    })
    eventStartTime?: string;

    @Column('date', {
        nullable: false,
        name: 'event_end_date',
    })
    eventEndDate?: string;

    @Column('time', {
        nullable: false,
        name: 'event_end_time',
    })
    eventEndTime?: string;

    @Column('int8', {
        nullable: true,
        name: 'assignee_usr_id',
    })
    assigneeUsrId?: number;

    @Column('int8', {
        nullable: true,
        name: 'assignee_team_id',
    })
    assigneeTeamId?: number;

    @Column('int8', {
        nullable: true,
        name: 'patient_id',
    })
    patientId?: number;

    @Column('text', {
        nullable: true,
        name: 'cancel_reason_type',
    })
    cancelReasonType?: string;

    @Column('text', {
        nullable: true,
        name: 'cancel_reason_text',
    })
    cancelReasonText?: string;

    @Column('int8', {
        nullable: true,
        name: 'rescheduled_event_id',
    })
    rescheduledEventId?: number;

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

    @OneToOne(() => Encounter, (encounter) => encounter.event)
    encounter?: Encounter;

    @OneToOne(() => EventState, (eventState) => eventState.eventState)
    @JoinColumn({ name: 'event_state_id' })
    eventState?: EventState;

    @ManyToOne(() => User, (user) => user.events)
    @JoinColumn({ name: 'assignee_usr_id' })
    assigneeUsr?: User;

    @ManyToOne(() => Team, (team) => team.events)
    @JoinColumn({ name: 'assignee_team_id' })
    assigneeTeam?: Team;

    @ManyToOne(() => Patient, (patient) => patient.events)
    @JoinColumn({ name: 'patient_id' })
    patient?: Patient;

    @ManyToOne(() => Facility, (facility) => facility.events)
    @JoinColumn({ name: 'fac_id' })
    facility?: Facility;
}
