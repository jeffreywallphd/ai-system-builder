import type { ConversationSessionRecord } from '../../../contracts/conversations';
import type { ExecutionApprovalRecord } from '../../../contracts/execution-runs';

export class ConversationSessionApprovalValidityService {
  public isValid(session: ConversationSessionRecord, approval?: ExecutionApprovalRecord) {
    if (session.status !== 'approved' && session.status !== 'active') return { valid: false, reason: 'approval-required' };
    if (!approval || approval.approvalStatus !== 'approved' || approval.invalidatedAt) return { valid: false, reason: 'approval-invalidated' };
    return { valid: true as const };
  }
}
