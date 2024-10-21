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
import { PatientNeedState } from './PatientNeedState';

@Entity('patient_need', { schema: 'graphium' })
export class PatientNeed {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_need_id',
    })
    patientNeedId?: number;

    @Column('int8', {
        nullable: false,
        name: 'patient_id',
    })
    patientId?: number;

    @Column('int4', {
        nullable: false,
        name: 'patient_need_state_id',
    })
    patientNeedStateId?: number;

    @Column('jsonb', {
        nullable: false,
        name: 'patient_need_state_transitions',
    })
    patientNeedStateTransitions?: {};

    @Column('text', {
        nullable: false,
        name: 'patient_need_type',
    })
    patientNeedType?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_need_description',
    })
    patientNeedDescription?: string;

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

    @OneToOne(() => PatientNeedState, (needState) => needState.needState)
    @JoinColumn({ name: 'patient_need_state_id' })
    needState?: PatientNeedState;
}
