import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FormDefinition } from './FormDefinition';
import { Encounter } from './Encounter';
import { FormDefinitionHistory } from './FormDefinitionHistory';
import { EncounterFormPage } from './EncounterFormPage';
import { EncounterFormData } from './EncounterFormData';
import { EncounterFormPageStroke } from './EncounterFormPageStroke';

@Entity('enctr_form', { schema: 'graphium' })
export class EncounterForm {
    @PrimaryGeneratedColumn('increment', {
        name: 'enctr_form_id',
    })
    enctrFormId?: number;

    @Column('int8', {
        nullable: false,
        name: 'enctr_id',
    })
    enctrId?: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_id',
    })
    formDefnId?: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_ver',
    })
    formDefnVer?: number;

    @Column('boolean', {
        nullable: false,
        name: 'form_valid_ind',
    })
    formValidInd?: boolean;

    @Column('boolean', {
        nullable: false,
        name: 'void_ind',
    })
    voidInd?: boolean;

    @Column('numeric', {
        nullable: true,
        name: 'form_cmplt_pct',
    })
    formCmpltPct?: number;

    @Column('timestamp', {
        nullable: true,
        name: 'form_last_opnd_dttm',
    })
    formLastOpndDttm?: Date;

    @Column('boolean', {
        nullable: false,
        default: false,
        name: 'ext_stroke_storage_ind',
    })
    extStrokeStorageInd?: boolean;

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

    pages?: EncounterFormPage[];
    strokes?: EncounterFormPageStroke[];
    modelData?: EncounterFormData;

    @ManyToOne(() => FormDefinition, (formDefinition) => formDefinition.encounterForms)
    @JoinColumn({ name: 'form_defn_id' })
    formDefinition?: FormDefinition;

    @ManyToOne(() => FormDefinitionHistory, (formDefinition) => formDefinition.encounterForms)
    @JoinColumn([
        { name: 'form_defn_id', referencedColumnName: 'formDefnId' },
        { name: 'form_defn_ver', referencedColumnName: 'formDefnVer' },
    ])
    formDefinitionHistory?: FormDefinitionHistory;

    @ManyToOne(() => Encounter, (encounter) => encounter.forms)
    @JoinColumn({ name: 'enctr_id' })
    encounter?: Encounter;

    public toLegacyJson(): any {
        return {
            encounterFormId: this.enctrFormId,
            encounterId: this.enctrId,
            formDefinitionId: this.formDefnId,
            formDefinitionVersion: this.formDefnVer,
            formValid: this.formValidInd,
            voided: this.voidInd,
            percentComplete: this.formCmpltPct,
            lastOpenedDate: this.formLastOpndDttm,
            createTime: this.insDttm,
            updateTime: this.updDttm,
            auditVersion: this.audVer,
            formTags: null, // TODO
            pages: this.pages,
            strokes: this.strokes,
            modelData: this.modelData,
            formDef: this.formDefinition,
            modelDefinition: null, // TODO
        };
    }
}
