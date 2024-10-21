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
import { OrgRole } from './OrgRole';
import { Facility } from './Facility';
import { PatientState } from './PatientState';
import { Event } from './Event';

@Entity('patient', { schema: 'graphium' })
export class Patient {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_id',
    })
    patientId?: number;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

    @Column('text', {
        nullable: false,
        name: 'patient_number',
    })
    patientNumber?: string;

    @Column('int4', {
        nullable: false,
        name: 'patient_state_id',
    })
    patientStateId?: number;

    @Column('jsonb', {
        nullable: false,
        name: 'patient_state_transitions',
    })
    patientStateTransitions?: any[];

    @Column('text', {
        nullable: false,
        name: 'patient_last_name',
    })
    patientLastName?: string;

    @Column('text', {
        nullable: false,
        name: 'patient_first_name',
    })
    patientFirstName?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_middle_name',
    })
    patientMiddleName?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_ssn',
    })
    patientSsn?: string;

    @Column('date', {
        nullable: true,
        name: 'patient_dob',
    })
    patientDob?: Date;

    @Column('jsonb', {
        nullable: false,
        name: 'patient_addresses',
    })
    patientAddresses?: any[];

    @Column('jsonb', {
        nullable: false,
        name: 'patient_phones',
    })
    patientPhones?: any[];

    @Column('jsonb', {
        nullable: false,
        name: 'patient_emails',
    })
    patientEmails?: any[];

    @Column('text', {
        nullable: true,
        name: 'patient_gender_code',
    })
    patientGenderCode?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_race_code',
    })
    patientRaceCode?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_ethnicity_code',
    })
    patientEthnicityCode?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_primary_language_code',
    })
    patientPrimaryLanguageCode?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_referral_source',
    })
    patientReferralSource?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_referral_reason',
    })
    patientReferralReason?: string;

    @Column('boolean', {
        nullable: true,
        name: 'patient_has_insurance_ind',
    })
    patientHasInsuranceInd?: boolean;

    @Column('boolean', {
        nullable: true,
        name: 'patient_do_not_resuscitate_ind',
    })
    patientDoNotResuscitateInd?: boolean;

    @Column('text', {
        nullable: true,
        name: 'primary_provider_name',
    })
    primaryProviderName?: string;

    @Column('text', {
        nullable: true,
        name: 'primary_provider_address',
    })
    primaryProviderAddress?: string;

    @Column('text', {
        nullable: true,
        name: 'primary_provider_specialty',
    })
    primaryProviderSpecialty?: string;

    @Column('text', {
        nullable: true,
        name: 'primary_provider_phone',
    })
    primaryProviderPhone?: string;

    @Column('text', {
        nullable: true,
        name: 'additional_providers_note',
    })
    additionalProvidersNote?: string;

    @Column('text', {
        nullable: true,
        name: 'power_of_attorney_name',
    })
    powerOfAttorneyName?: string;

    @Column('text', {
        nullable: true,
        name: 'power_of_attorney_phone',
    })
    powerOfAttorneyPhone?: string;

    @Column('text', {
        nullable: true,
        name: 'emergency_contact_name',
    })
    emergencyContactName?: string;

    @Column('text', {
        nullable: true,
        name: 'emergency_contact_phone',
    })
    emergencyContactPhone?: string;

    @Column('text', {
        nullable: true,
        name: 'emergency_contact_relationship_code',
    })
    emergencyContactRelationshipCode?: string;

    @Column('text', {
        nullable: true,
        name: 'primary_diagnosis_note',
    })
    primaryDiagnosisNote?: string;

    @Column('text', {
        nullable: true,
        name: 'allergy_note',
    })
    allergyNote?: string;

    @Column('text', {
        nullable: true,
        name: 'past_medical_history_note',
    })
    pastMedicalHistoryNote?: string;

    @Column('text', {
        nullable: true,
        name: 'immunization_history_note',
    })
    immunizationHistoryNote?: string;

    @Column('text', {
        nullable: true,
        name: 'family_history_note',
    })
    familyHistoryNote?: string;

    @Column('text', {
        nullable: true,
        name: 'social_history_note',
    })
    socialHistoryNote?: string;

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

    // @ManyToMany((type) => OrgRole)
    // @JoinColumn({ name: 'usr_role' })
    // roles: OrgRole[];

    // @ManyToMany((type) => Facility)
    // facilities: Facility[];
    @OneToOne(() => PatientState, (patientState) => patientState.patientState)
    @JoinColumn({ name: 'patient_state_id' })
    patientState: PatientState;

    @OneToMany(() => Event, (event) => event.patient)
    events?: Event[];

    @ManyToOne(() => Facility, (facility) => facility.patients)
    @JoinColumn({ name: 'fac_id' })
    facility?: Facility;
}
