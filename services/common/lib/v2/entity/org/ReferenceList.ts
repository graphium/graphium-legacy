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
import { ReferenceListValue } from './ReferenceListValue';

@Entity('reference_list', { schema: 'graphium' })
export class ReferenceList {
    @PrimaryGeneratedColumn('increment', {
        name: 'list_id',
    })
    listId?: number;

    @Column('text', {
        nullable: false,
        name: 'list_name',
    })
    listName?: string;

    @Column('text', {
        nullable: false,
        name: 'list_display_name',
    })
    listDisplayName?: string;

    @Column('text', {
        nullable: false,
        name: 'list_description',
    })
    listDescription?: string;

    @Column('int4', {
        nullable: false,
        name: 'admin_role_list',
    })
    adminRoleList?: number[];

    @Column('jsonb', {
        nullable: true,
        name: 'list_extended_properties',
    })
    listExtendedProperties?: any[];

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

    @Column('int8', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;

    @OneToMany(() => ReferenceListValue, (value) => value.referenceList)
    referenceListValues?: ReferenceListValue[];
}
