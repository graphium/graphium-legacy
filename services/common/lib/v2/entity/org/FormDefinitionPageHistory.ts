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
import { FormDefinitionHistory } from './FormDefinitionHistory';
import * as utils from '../../../util';

@Entity('form_defn_page_hist', { schema: 'graphium' })
export class FormDefinitionPageHistory {
    @PrimaryGeneratedColumn('increment', {
        name: 'form_defn_page_hist_id',
    })
    formDefnPageHistId: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_page_id',
    })
    formDefnPageId?: number;

    @Column('int4', {
        nullable: false,
        name: 'form_defn_hist_id',
    })
    formDefnHistId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'page_nm',
    })
    pageNm?: string;

    @Column('bytea', {
        nullable: true,
        name: 'page_cntnt',
        transformer: {
            from: (value) => {
                return utils.formatBufferColumnToBase64(value);
            },
            to: (value) => {
                return value;
            },
        },
    })
    pageCntnt?: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'page_cntnt_hash',
    })
    pageCntntHash?: string;

    @Column('int2', {
        nullable: false,
        name: 'min_cnt',
    })
    minCnt?: number;

    @Column('int2', {
        nullable: true,
        name: 'max_cnt',
    })
    maxCnt?: number;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm?: Date;

    @ManyToOne(() => FormDefinitionHistory, (formDefnHist) => formDefnHist.formDefinitionPageHistories)
    @JoinColumn({ name: 'form_defn_hist_id' })
    formDefinitionHistory: FormDefinitionHistory;

    public toLegacyJson(): any {
        return {
            formDefinitionPageId: this.formDefnPageHistId,
            formDefinitionId: this.formDefnHistId,
            pageName: this.pageNm,
            pageContent: this.pageCntnt,
            createTime: this.insDttm,
        };
    }
}
