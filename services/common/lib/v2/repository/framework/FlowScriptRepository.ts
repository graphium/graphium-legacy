import { EntityRepository, Repository, Entity } from 'typeorm';
import { FlowScript } from '../../entity/framework/FlowScript';

@EntityRepository(FlowScript)
export class FlowScriptRepository extends Repository<FlowScript> {

}