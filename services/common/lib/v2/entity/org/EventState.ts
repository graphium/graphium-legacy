import { OneToOne, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Event } from './Event';

@Entity('event_state', { schema: 'graphium' })
export class EventState {
    @PrimaryGeneratedColumn('increment', {
        name: 'event_state_id',
    })
    eventStateId?: number;

    @Column('text', {
        nullable: false,
        name: 'event_state_code',
    })
    eventStateCode?: string;

    @Column('text', {
        nullable: false,
        name: 'event_state_title',
    })
    eventStateTitle?: string;

    @Column('text', {
        nullable: true,
        name: 'event_state_description',
    })
    eventStateDescription?: string;

    @Column('boolean', {
        nullable: false,
        default: true,
        name: 'actv_ind',
    })
    actvInd?: boolean;

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

    @OneToOne(() => Event, (event) => event.eventState)
    eventState?: Event;
}
