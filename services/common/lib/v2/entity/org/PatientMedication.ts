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

@Entity('patient_medication', { schema: 'graphium' })
export class PatientMedication {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_medication_id',
    })
    patientMedicationId?: number;

    @Column('int8', {
        nullable: false,
        name: 'patient_id',
    })
    patientId?: number;

    @Column('text', {
        nullable: false,
        name: 'medication_name',
    })
    medicationName?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_brand_name',
    })
    medicationBrandName?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_dose_amount',
    })
    medicationDoseAmount?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_dose_units',
    })
    medicationDoseUnits?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_admin_route',
    })
    medicationAdminRoute?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_frequency',
    })
    medicationFrequency?: string;

    @Column('text', {
        nullable: true,
        name: 'directed_usage_type',
    })
    directedUsageType?: string;

    @Column('text', {
        nullable: true,
        name: 'medication_instructions',
    })
    medicationInstructions?: string;

    @Column('numeric', {
        nullable: true,
        name: 'medication_total_qty',
    })
    medicationTotalQty?: number;

    @Column('boolean', {
        nullable: false,
        default: false,
        name: 'opioid_indicator',
    })
    opioidIndicator?: boolean;

    @Column('date', {
        nullable: true,
        name: 'medication_start_date',
    })
    medicationStartDate?: Date;

    @Column('date', {
        nullable: true,
        name: 'medication_end_date',
    })
    medicationEndDate?: Date;

    @Column('text', {
        nullable: true,
        name: 'medication_purpose',
    })
    medicationPurpose?: string;

    @Column('text', {
        nullable: true,
        name: 'prescribed_by',
    })
    prescribedBy?: string;

    @Column('date', {
        nullable: true,
        name: 'prescription_date',
    })
    prescriptionDate?: Date;

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
}
