import { FormDefinitionHistory } from './FormDefinitionHistory';
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
import { ModelDefinition } from './ModelDefinition';

@Entity('form_defn', { schema: 'graphium' })
export class FormDefinition {
    @PrimaryGeneratedColumn('increment', {
        name: 'form_defn_id',
    })
    formDefnId?: number;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId?: number;

    @Column('int4', {
        nullable: false,
        name: 'model_defn_id',
    })
    modelDefnId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'form_defn_nm',
    })
    formDefnNm?: string;

    @Column('text', {
        nullable: false,
        name: 'form_defn_desc',
    })
    formDefnDesc?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'form_defn_title',
    })
    formDefnTitle?: string;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_ver',
    })
    formDefnVer?: number;

    @Column('text', {
        nullable: false,
        name: 'form_defn_cntnt',
    })
    formDefnCntnt?: string;

    @Column('int4', {
        nullable: false,
        name: 'model_defn_ver',
    })
    modelDefnVer?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'form_defn_typ',
    })
    formDefnTyp?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'form_defn_schema_ver',
    })
    formDefnSchemaVer?: string;

    @Column('hstore', {
        nullable: true,
        name: 'prop_map',
    })
    propMap?: string;

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

    @Column('bool', {
        nullable: false,
        name: 'actv_ind',
    })
    actvInd?: boolean;

    @OneToMany(() => EncounterForm, (enctr) => enctr.formDefinition)
    @JoinColumn({ name: 'form_defn_id' })
    encounterForms?: EncounterForm[];

    @OneToMany(() => FormDefinitionHistory, (fdh) => fdh.formDefinition)
    @JoinColumn({ name: 'form_defn_id' })
    formDefinitionHistories?: FormDefinitionHistory[];

    public toLegacyJson(): any {
        return {
            formDefinitionId: this.formDefnId,
            facilityId: this.facId,
            formDefinitionName: this.formDefnNm,
            formDefinitionTitle: this.formDefnTitle,
            formDefinitionDescription: this.formDefnDesc,
            formDefinitionVersion: this.formDefnVer,
            formDefinitionContent: this.formDefnCntnt,
            modelDefinitionId: this.modelDefnId,
            formDefinitionType: this.formDefnTyp,
            schemaVersion: this.formDefnSchemaVer,
            active: this.actvInd,
            createTime: this.insDttm,
            updateTime: this.updDttm,
            auditVersion: this.audVer,
            formDefinitionPages: null, // ????
        };
    }
}
