import { EntityRepository, Repository } from 'typeorm';
import { FlowScriptHistory } from '../../entity/framework/FlowScriptHistory';

@EntityRepository(FlowScriptHistory)
export class FlowScriptHistoryRepository extends Repository<FlowScriptHistory> {

}