import { EntityRepository, Repository } from 'typeorm';
import { FlowScriptTemplate } from '../../entity/framework/FlowScriptTemplate';

@EntityRepository(FlowScriptTemplate)
export class FlowScriptTemplateRepository extends Repository<FlowScriptTemplate> {

}