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
import { ReferenceList } from './ReferenceList';

@Entity('reference_list_value', { schema: 'graphium' })
export class ReferenceListValue {
    @PrimaryGeneratedColumn('increment', {
        name: 'list_value_id',
    })
    listValueId?: number;

    @Column('int8', {
        nullable: false,
        name: 'list_id',
    })
    listId?: number;

    @Column('text', {
        nullable: false,
        name: 'list_value_code',
    })
    listValueCode?: string;

    @Column('text', {
        nullable: false,
        name: 'list_value_display_name',
    })
    listValueDisplayName?: string;

    @Column('text', {
        nullable: false,
        name: 'list_value_description',
    })
    listValueDescription?: string;

    @Column('jsonb', {
        nullable: true,
        name: 'list_value_extended_properties',
    })
    listValueExtendedProperties?: string;

    @Column('int4', {
        nullable: true,
        name: 'facility_display_exclude_list',
    })
    facilityDisplayExcludeList?: number[];

    @Column('boolean', {
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

    @ManyToOne(type=>ReferenceList, ReferenceList=>ReferenceList.referenceListValues)
    @JoinColumn({ name:'list_id'})
    referenceList:ReferenceList | null;
}
