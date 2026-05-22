import { normalizeApproveConversationSessionCommand, type ApproveConversationSessionCommand, type ApproveConversationSessionResult } from '../../../contracts/conversations';
import { normalizeExecutionApprovalId } from '../../../contracts/execution-runs';
import type { ConversationSessionRepositoryPort } from '../../ports/conversations';
import type { ExecutionApprovalRepositoryPort } from '../../ports/execution-runs';
import type { ExecutionPlanRepositoryPort } from '../../ports/execution-plans';
import type { RuntimeReadinessBindingRepositoryPort } from '../../ports/runtime-readiness';
import type { AssetCompositionPlanRepositoryPort } from '../../ports/asset-composition';
import { conversationSessionFailure } from './conversation-session-result-helpers';
import { ConversationalExecutionPlanEligibilityService } from './conversational-execution-plan-eligibility.service';
import { ConversationalSourceSystemVerificationService } from './conversational-source-system-verification.service';

export class ApproveConversationSessionUseCase {
  public constructor(private readonly d:{sessionRepository:ConversationSessionRepositoryPort;approvalRepository:ExecutionApprovalRepositoryPort;executionPlanRepository:ExecutionPlanRepositoryPort;runtimeReadinessRepository:RuntimeReadinessBindingRepositoryPort;assetCompositionPlanRepository: AssetCompositionPlanRepositoryPort;eligibilityService:ConversationalExecutionPlanEligibilityService;sourceVerificationService:ConversationalSourceSystemVerificationService;nextApprovalId:()=>string;now?:()=>string}){}
  public async execute(command: ApproveConversationSessionCommand): Promise<ApproveConversationSessionResult>{
    let c; try { c = normalizeApproveConversationSessionCommand(command); } catch { return conversationSessionFailure('validation','conversation-session-approval-input-invalid','Workspace, session, and approval identifiers are required.'); }
    const now=(this.d.now??(()=>new Date().toISOString()))();
    const session=await this.d.sessionRepository.getConversationSessionById(c.workspaceId,c.conversationSessionId); if(!session) return conversationSessionFailure('not-found','conversation-session-not-found','Conversation session was not found.');
    if (session.archivedAt || ['closed','stale','invalid','blocked'].includes(session.status)) return conversationSessionFailure('conflict','conversation-session-not-approvable','Conversation session is not approvable in its current state.');
    const plan=await this.d.executionPlanRepository.getExecutionPlanById(c.workspaceId,session.sourceExecutionPlanId); if(!plan) return conversationSessionFailure('not-found','source-execution-plan-not-found','Source execution plan was not found.');
    const pe=this.d.eligibilityService.evaluatePlan(plan); if(!pe.eligible) return conversationSessionFailure('conflict',pe.code!,pe.message!);
    const compositionPlan = await this.d.assetCompositionPlanRepository.readAssetCompositionPlanRecord(c.workspaceId as any, plan.sourceCompositionPlanId as any);
    const sv=this.d.sourceVerificationService.verify(plan, compositionPlan); if(!sv.ok) return conversationSessionFailure('conflict',sv.code,sv.message);
    const rb=await this.d.runtimeReadinessRepository.readRuntimeReadinessBindingRecord(c.workspaceId,plan.sourceRuntimeReadinessBindingId as any); const re=this.d.eligibilityService.evaluateReadiness(rb, c.workspaceId, plan.sourceCompositionPlanId); if(!re.eligible) return conversationSessionFailure('runtime-not-ready',re.code!,re.message!);
    const approvalId=normalizeExecutionApprovalId(this.d.nextApprovalId());
    await this.d.approvalRepository.saveExecutionApproval({id:approvalId,workspaceId:c.workspaceId,sourceExecutionPlanId:plan.id,conversationSessionId:session.id,approvalKind:'conversation-session-execution',approvalStatus:'approved',label:'Conversation Session Approval',runtimeReferenceId:session.runtimeReferenceId,sourcePlanRevision:plan.updatedAt,sourceReadinessRevision:rb?.updatedAt,createdAt:now,updatedAt:now,grantedAt:now,provenance:[{at:now,kind:'conversation-session-approval-granted',actor:'application'}],blockers:[],diagnostics:[]});
    const updated = await this.d.sessionRepository.updateConversationSession({...session,status:'approved',executionApprovalId:approvalId,executionApprovalStatus:'approved',updatedAt:now,provenance:[...session.provenance,{at:now,kind:'conversation-session-approved',actor:'application'}]});
    return {kind:'success',value:updated};
  }
}
