import { Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinColumn } from 'typeorm';
import { FormDefinitionHistory } from './FormDefinitionHistory';
import { ModelDefinitionSchema } from '../../../model/model/ModelDefinitionSchema';

@Entity('model_defn', { schema: 'graphium' })
export class ModelDefinition {
    @PrimaryGeneratedColumn('increment', {
        name: 'model_defn_id',
    })
    modelDefnId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'model_defn_nm',
    })
    modelDefnNm?: string;

    @Column('text', {
        nullable: false,
        name: 'model_defn_desc',
    })
    modelDefnDesc?: string;

    @Column('int4', {
        nullable: false,
        name: 'model_defn_ver',
    })
    modelDefnVer?: number;

    @Column('text', {
        nullable: false,
        select: false,
        name: 'model_defn_cntnt',
    })
    modelDefnCntnt?: string;

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

    @Column('int4', {
        nullable: true,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    @OneToMany(() => FormDefinitionHistory, (formDefinitionHistory) => formDefinitionHistory.modelDefinition)
    @JoinColumn({ name: 'form_defn_id' })
    formDefinitionHistories?: FormDefinitionHistory[];

    modelDefinitionSchema: ModelDefinitionSchema;

    async parseModelDefinitionContent() {
        if (this.modelDefnCntnt) {
            let modelDefinitionSchema = new ModelDefinitionSchema(
                new Buffer(this.modelDefnCntnt.substring(2), 'hex').toString(),
            );
            await modelDefinitionSchema.parseModelDefinitionContent();
            this.modelDefinitionSchema = modelDefinitionSchema;
        }
    }

    public toLegacyJson(): any {
        return {
            modelDefinitionId: this.modelDefnId,
            modelDefinitionName: this.modelDefnNm,
            modelDefinitionDescription: this.modelDefnDesc,
            modelDefinitionVersion: this.modelDefnVer,
            createTime: this.insDttm,
            active: this.actvInd,
            updateTime: this.updDttm,
            auditVersion: this.audVer,
            modelName: this.modelDefinitionSchema ? this.modelDefinitionSchema.name : null,
            modelDefinitionTitle: this.modelDefinitionSchema ? this.modelDefinitionSchema.title : null,
            properties: this.modelDefinitionSchema ? this.modelDefinitionSchema.properties : null,
        };
    }
}
