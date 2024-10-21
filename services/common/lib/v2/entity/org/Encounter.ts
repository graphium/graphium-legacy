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
import { Event } from './Event';
import { EncounterForm } from './EncounterForm';

@Entity('enctr', { schema: 'graphium' })
export class Encounter {
    @PrimaryGeneratedColumn('increment', {
        name: 'enctr_id',
    })
    enctrId: number;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'enctr_no',
    })
    enctrNo?: string;

    @Column('varchar', {
        nullable: false,
        length: 100,
        name: 'pat_mrn',
    })
    patMrn?: string;

    @Column('text', {
        nullable: false,
        name: 'pat_last_nm',
    })
    patLastNm?: string;

    @Column('text', {
        nullable: false,
        name: 'pat_frst_nm',
    })
    patFrstNm?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_mid_nm',
    })
    patMidNm?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_ssn',
    })
    patSsn?: string;

    @Column('date', {
        nullable: true,
        name: 'pat_dob',
    })
    patDob?: Date;

    @Column('varchar', {
        nullable: true,
        length: 100,
        name: 'pat_zip_cd',
    })
    patZipCd?: string;

    @Column('date', {
        nullable: true,
        name: 'admit_dt',
    })
    admitDt?: string;

    @Column('time', {
        nullable: true,
        name: 'admit_tm',
    })
    admitTm?: string;

    @Column('date', {
        nullable: true,
        name: 'disch_dt',
    })
    dischDt?: string;

    @Column('time', {
        nullable: true,
        name: 'disch_tm',
    })
    dischTm?: string;

    @Column('boolean', {
        nullable: false,
        default: false,
        name: 'purged_ind',
    })
    purgedInd?: boolean;

    @Column('date', {
        nullable: true,
        name: 'purged_dttm',
    })
    purgedDttm?: Date;

    @Column('text', {
        nullable: true,
        name: 'pat_addr_ln_1',
    })
    patAddrLn1?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_addr_ln_2',
    })
    patAddrLn2?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_city',
    })
    patCity?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_state_cd',
    })
    patStateCd?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_cntry_cd',
    })
    patCntryCd?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_ph_no_home',
    })
    patPhNoHome?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_ph_no_bus',
    })
    patPhNoBus?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_ph_no_mob',
    })
    patPhNoMob?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_email_home',
    })
    patEmailHome?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_email_bus',
    })
    patEmailBus?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_dr_lic_no',
    })
    patDrLicNo?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_dr_lic_st',
    })
    patDrLicSt?: string;

    @Column('date', {
        nullable: true,
        name: 'pat_dr_lic_exp',
    })
    patDrLicExp?: Date;

    @Column('text', {
        nullable: true,
        name: 'pat_occup',
    })
    patOccup?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_prim_lang',
    })
    patPrimLang?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_marital_status',
    })
    patMaritalStatus?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_religion',
    })
    patReligion?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_gender_cd',
    })
    patGenderCd?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_race',
    })
    patRace?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_ethnic_grp',
    })
    patEthnicGrp?: string;

    @Column('text', {
        nullable: true,
        name: 'pat_nationality',
    })
    patNationality?: string;

    @Column('boolean', {
        nullable: true,
        name: 'pat_deceased_ind',
    })
    patDeceasedInd?: boolean;

    @Column('date', {
        nullable: true,
        name: 'pat_deceased_dt',
    })
    patDeceasedDt?: Date;

    @Column('text', {
        nullable: true,
        name: 'enctr_admit_typ',
    })
    enctrAdmitTyp?: string;

    @Column('text', {
        nullable: true,
        name: 'enctr_pat_class',
    })
    enctrPatClass?: string;

    @Column('text', {
        nullable: true,
        name: 'enctr_pat_typ',
    })
    enctrPatTyp?: string;

    @Column('text', {
        nullable: true,
        name: 'enctr_hosp_svc_cd',
    })
    enctrHospSvcCd?: string;

    @Column('date', {
        nullable: true,
        name: 'acc_dt',
    })
    accDt?: Date;

    @Column('text', {
        nullable: true,
        name: 'acc_cd',
    })
    accCd?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_desc',
    })
    accDesc?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_locn',
    })
    accLocn?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_auto_st_cd',
    })
    accAutoStCd?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_auto_st_nm',
    })
    accAutoStNm?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_job_rel_ind',
    })
    accJobRelInd?: string;

    @Column('text', {
        nullable: true,
        name: 'acc_death_ind',
    })
    accDeathInd?: string;

    @Column('json', {
        nullable: true,
        name: 'enctr_insurance_doc',
    })
    enctrInsuranceDoc?: JSON;

    @Column('json', {
        nullable: true,
        name: 'enctr_diagnosis_doc',
    })
    enctrDiagnosisDoc?: JSON;

    @Column('json', {
        nullable: true,
        name: 'enctr_relations_doc',
    })
    enctrRelationsDoc?: JSON;

    @Column('json', {
        nullable: true,
        name: 'enctr_guarantor_doc',
    })
    enctrGuarantorDoc?: JSON;

    @Column('text', {
        nullable: true,
        name: 'enctr_fin_class',
    })
    enctrFinClass?: string;

    @Column('text', {
        nullable: false,
        default: 'ACTIVE',
        name: 'enctr_stat_cd',
    })
    enctrStatCd?: string;

    @Column('int8', {
        nullable: true,
        name: 'patient_id',
    })
    patientId?: number;

    @Column('int8', {
        nullable: true,
        name: 'event_id',
    })
    eventId?: number;

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

    @OneToOne(() => Event, (event) => event.encounter)
    @JoinColumn({ name: 'event_id' })
    event?: Event;

    @OneToMany(() => EncounterForm, (form) => form.encounter)
    forms?: EncounterForm[];

    public toLegacyJson(): any {
        return {
            encounterId: this.enctrId,
            facilityId: this.facId,
            encounterNumber: this.enctrNo,
            patientMrn: this.patMrn,
            patientLastName: this.patLastNm,
            patientFirstName: this.patFrstNm,
            patientMiddleName: this.patMidNm,
            patientSsn: this.patSsn,
            encounterStatusCode: this.enctrStatCd,
            patientDob: this.patDob,
            admitDate: this.admitDt,
            admitTime: this.admitTm,
            dischargeDate: this.dischDt,
            dischargeTime: this.dischTm,
            createTime: this.insDttm,
            updateTime: this.updDttm,
            auditVersion: this.audVer,
            encounterTags: null, // TODO
            patientId: this.patientId,
            patientAddressLine1: this.patAddrLn1,
            patientAddressLine2: this.patAddrLn2,
            patientCity: this.patCity,
            patientState: this.patStateCd,
            patientZipCode: this.patZipCd,
            patientCountryCode: this.patCntryCd,
            patientHomePhone: this.patPhNoHome,
            patientWorkPhone: this.patPhNoBus,
            patientMobilePhone: this.patPhNoMob,
            patientHomeEmail: this.patEmailHome,
            patientWorkEmail: this.patEmailBus,
            patientDriversLicenseNum: this.patDrLicNo,
            patientDriversLicenseState: this.patDrLicSt,
            patientDriversLicenseExpDt: this.patDrLicExp,
            patientPrimaryLang: this.patPrimLang,
            patientMaritalStatus: this.patMaritalStatus,
            patientReligion: this.patReligion,
            patientGenderCd: this.patGenderCd,
            patientRace: this.patRace,
            patientEthnicGroup: this.patEthnicGrp,
            patientNationality: this.patNationality,
            patientDeceasedInd: this.patDeceasedInd,
            patientDeceasedDt: this.patDeceasedDt,
            admitType: this.enctrAdmitTyp,
            patientClass: this.enctrPatClass,
            patientType: this.enctrPatTyp,
            hospitalServiceCd: this.enctrHospSvcCd,
            financialClass: this.enctrFinClass,
            accidentDt: this.accDt,
            accidentCode: this.accCd,
            accidentDescription: this.accDesc,
            accidentLocation: this.accLocn,
            accidentAutoStateCd: this.accAutoStCd,
            accidentAutoStateName: this.accAutoStNm,
            accidentJobRelInd: this.accJobRelInd,
            accidentDeathInd: this.accDeathInd,
            insuranceJsonDocument: this.enctrInsuranceDoc,
            relationsJsonDocument: this.enctrRelationsDoc,
            guarantorJsonDocument: this.enctrGuarantorDoc,
            diagnosisJsonDocument: this.enctrDiagnosisDoc,
        };
    }
}
