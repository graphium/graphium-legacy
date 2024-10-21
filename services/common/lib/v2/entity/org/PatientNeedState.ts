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
import { PatientNeed } from './PatientNeed';

@Entity('patient_need_state', { schema: 'graphium' })
export class PatientNeedState {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_need_state_id',
    })
    patientNeedStateId?: number;

    @Column('text', {
        nullable: false,
        name: 'patient_need_state_code',
    })
    patientNeedStateCode?: string;

    @Column('text', {
        nullable: false,
        name: 'patient_need_state_title',
    })
    patientNeedStateTitle?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_need_state_description',
    })
    patientNeedStateDescription?: string;

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

    @OneToOne(() => PatientNeed, (need) => need.needState)
    needState?: PatientNeed;
}
