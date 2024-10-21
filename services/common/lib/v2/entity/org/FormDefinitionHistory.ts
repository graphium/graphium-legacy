import { FormDefinitionPageHistory } from './FormDefinitionPageHistory';
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
import { FormDefinition } from './FormDefinition';
import * as utils from '../../../util';

@Entity('form_defn_hist', { schema: 'graphium' })
export class FormDefinitionHistory {
    @PrimaryGeneratedColumn('increment', {
        name: 'form_defn_hist_id',
    })
    formDefnHistId?: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_id',
    })
    formDefnId?: number;

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
        select: false,
        name: 'form_defn_cntnt',
    })
    formDefnCntnt?: string;

    @Column('bool', {
        nullable: false,
        name: 'actv_ind',
    })
    actvInd?: boolean;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm?: Date;

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

    @ManyToOne(() => ModelDefinition, (modelDefinition) => modelDefinition.formDefinitionHistories)
    @JoinColumn({ name: 'model_defn_id' })
    modelDefinition: ModelDefinition;

    @ManyToOne(() => FormDefinition, (formDefinition) => formDefinition.formDefinitionHistories)
    @JoinColumn({ name: 'form_defn_id' })
    formDefinition: FormDefinition;

    @OneToMany(() => EncounterForm, (enctr) => enctr.formDefinitionHistory)
    @JoinColumn({ name: 'form_defn_id' })
    encounterForms?: EncounterForm[];

    @OneToMany(() => FormDefinitionPageHistory, (fdph) => fdph.formDefinitionHistory)
    @JoinColumn({ name: 'form_defn_hist_id' })
    formDefinitionPageHistories?: FormDefinitionPageHistory[];

    public toLegacyJson(): any {
        return {
            formDefinitionId: this.formDefnId,
            formDefinitionName: this.formDefnNm,
            formDefinitionTitle: this.formDefnTitle,
            formDefinitionDescription: this.formDefnDesc,
            formDefinitionVersion: this.formDefnVer,
            formDefinitionContent: utils.convertAsciiEncodedString(this.formDefnCntnt),
            modelDefinitionId: this.modelDefnId,
            formDefinitionType: this.formDefnTyp,
            schemaVersion: this.formDefnSchemaVer,
            active: this.actvInd,
            formDefinitionPages: this.formDefinitionPageHistories,
        };
    }
}
