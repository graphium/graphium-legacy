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
import { Patient } from './Patient';

@Entity('patient_state', { schema: 'graphium' })
export class PatientState {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_state_id',
    })
    patientStateId?: number;

    @Column('text', {
        nullable: false,
        name: 'patient_state_code',
    })
    patientStateCode?: string;

    @Column('text', {
        nullable: false,
        name: 'patient_state_title',
    })
    patientStateTitle?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_state_description',
    })
    patientStateDescription?: string;

    @Column('boolean', {
        nullable: true,
        name: 'actv_ind',
        default: true,
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

    @Column('int4', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    @OneToOne(() => Patient, (patient) => patient.patientState)
    patientState?: Patient;
}
