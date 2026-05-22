export type ConversationTurnFailureCode =
  | 'approval-required'
  | 'approval-invalidated'
  | 'source-plan-not-ready'
  | 'source-plan-stale'
  | 'runtime-readiness-not-acceptable'
  | 'runtime-unavailable'
  | 'runtime-not-ready'
  | 'runtime-unsupported'
  | 'invocation-failed'
  | 'invocation-cancelled'
  | 'invocation-timed-out'
  | 'assistant-response-invalid'
  | 'assistant-response-too-long'
  | 'response-recording-failed'
  | 'result-recording-failed'
  | 'retry-not-allowed'
  | 'internal-error';

export class ConversationTurnFailureClassificationService {
  public classify(status: string): ConversationTurnFailureCode {
    if (status === 'approval-required') return 'approval-required';
    if (status === 'approval-invalidated') return 'approval-invalidated';
    if (status === 'not-ready') return 'runtime-not-ready';
    if (status === 'unavailable') return 'runtime-unavailable';
    if (status === 'unsupported' || status === 'deferred') return 'runtime-unsupported';
    if (status === 'timed-out') return 'invocation-timed-out';
    if (status === 'cancelled') return 'invocation-cancelled';
    if (status === 'blocked') return 'runtime-readiness-not-acceptable';
    if (status === 'failed') return 'invocation-failed';
    return 'internal-error';
  }
}
