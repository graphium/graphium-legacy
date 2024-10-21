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

@Entity('enctr_form_tag', { schema: 'graphium' })
export class EncounterFormTag {
    @PrimaryColumn('int8', {
        nullable: false,
        name: 'enctr_form_id',
    })
    enctrFormId: number;

    @PrimaryColumn('int4', {
        nullable: false,
        name: 'tag_id',
    })
    tagId: number;

    @PrimaryColumn('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId: number;

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

    // @OneToMany(() => EncounterForm, (form) => form.encounter)
    // forms?: EncounterForm[];
}
