import { EntityRepository, Repository } from 'typeorm';
import { FlowScriptTemplateHistory } from '../../entity/framework/FlowScriptTemplateHistory';

@EntityRepository(FlowScriptTemplateHistory)
export class FlowScriptTemplateHistoryRepository extends Repository<FlowScriptTemplateHistory> {

}