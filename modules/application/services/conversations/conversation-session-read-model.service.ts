import type { AssistantResponseRepositoryPort, ConversationSessionRepositoryPort, ConversationTurnRepositoryPort } from '../../ports/conversations';
import type { ExecutionRunRepositoryPort } from '../../ports/execution-runs';
import { createWorkspaceId } from '../../../contracts/workspace';
import type { ConversationSessionRecord } from '../../../contracts/conversations';
import type { ConversationSessionDetailReadModel, ConversationSessionListItemReadModel } from './conversation-read-model-types';
import { ConversationSessionSourceSummaryService } from './conversation-session-source-summary.service';

export class ConversationSessionReadModelService {
  public constructor(
    private readonly sessionRepository: ConversationSessionRepositoryPort,
    private readonly turnRepository: ConversationTurnRepositoryPort,
    private readonly responseRepository: AssistantResponseRepositoryPort,
    private readonly runRepository: ExecutionRunRepositoryPort,
    private readonly sourceSummary = new ConversationSessionSourceSummaryService(),
  ) {}

  private approvalStatus(v?: string): ConversationSessionListItemReadModel['approvalStatus'] {
    if (v === 'approved' || v === 'granted') return 'approved';
    if (v === 'invalidated' || v === 'revoked' || v === 'expired') return 'approval-invalidated';
    if (!v || v === 'pending') return 'approval-required';
    return 'unknown';
  }

  private runtimeStatus(v?: string): ConversationSessionListItemReadModel['runtimeStatus'] {
    if (v === 'supported' || v === 'available-by-readiness') return 'ready';
    if (v === 'unsupported') return 'unsupported';
    if (v === 'needs-setup') return 'needs-setup';
    if (v === 'unavailable' || v === 'blocked' || v === 'stale' || v === 'invalid') return 'unavailable';
    return 'unknown';
  }

  private actions(s: ConversationSessionRecord, runtimeRefStatus?: string): ConversationSessionListItemReadModel['actions'] {
    const approved = this.approvalStatus(s.executionApprovalStatus) === 'approved';
    const runtimeReady = this.runtimeStatus(runtimeRefStatus) === 'ready';
    const maySubmitMessage = (s.status === 'approved' || s.status === 'active') && approved && runtimeReady;
    return { mayOpen: s.status !== 'archived', mayApprove: !approved, maySubmitMessage, mayClose: s.status === 'active', mayArchive: s.status === 'closed', mayCancel: false, mayRetry: false };
  }

  private async toItem(workspaceId: ReturnType<typeof createWorkspaceId>, s: ConversationSessionRecord): Promise<ConversationSessionListItemReadModel> {
    const latestTurn = await this.turnRepository.getLatestConversationTurnBySession(workspaceId, s.id);
    const latestActivityAt = latestTurn?.updatedAt ?? s.updatedAt;
    const responses = latestTurn ? await this.responseRepository.listAssistantResponsesByTurn(workspaceId, latestTurn.id) : [];
    const runtimeRefStatus = s.provenance.at(-1)?.runtimeReferenceStatus as string | undefined;
    return {
      conversationSessionId: s.id,
      sessionLabel: s.systemLabel,
      sourceExecutionPlanId: s.sourceExecutionPlanId,
      sourceCompositionPlanId: s.sourceCompositionPlanId,
      sessionStatus: s.status,
      approvalStatus: this.approvalStatus(s.executionApprovalStatus),
      runtimeStatus: this.runtimeStatus(runtimeRefStatus),
      turnCount: s.turnIds.length,
      latestAssistantResponseAvailable: responses.some((r) => r.status === 'completed'),
      latestActivityAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      closedAt: s.closedAt,
      archivedAt: s.archivedAt,
      actions: this.actions(s, runtimeRefStatus),
    };
  }

  public async list(request: { workspaceId: string; includeArchived?: boolean; status?: ConversationSessionRecord['status'] }) {
    const workspaceId = createWorkspaceId(request.workspaceId);
    const { sessions } = await this.sessionRepository.listConversationSessions({ workspaceId, status: request.status, includeArchived: request.includeArchived });
    const items = await Promise.all(sessions.map((s) => this.toItem(workspaceId, s)));
    return { items };
  }

  public async readDetail(request: { workspaceId: string; conversationSessionId: string }): Promise<ConversationSessionDetailReadModel | undefined> {
    const workspaceId = createWorkspaceId(request.workspaceId);
    const session = await this.sessionRepository.getConversationSessionById(workspaceId, request.conversationSessionId as never);
    if (!session) return undefined;
    const item = await this.toItem(workspaceId, session);
    const latestTurn = await this.turnRepository.getLatestConversationTurnBySession(workspaceId, session.id);
    const latestRun = latestTurn?.executionRunId ? await this.runRepository.getExecutionRunById(workspaceId, latestTurn.executionRunId) : undefined;
    return { ...item, source: this.sourceSummary.summarize(session), latestTurnId: latestTurn?.id, latestTurnStatus: latestTurn?.status, latestRunStatus: latestRun?.status };
  }
}
