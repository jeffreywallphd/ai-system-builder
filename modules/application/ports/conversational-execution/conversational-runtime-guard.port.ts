export type ConversationalRuntimeGuardStatus =
  | 'ready'
  | 'starting'
  | 'unavailable'
  | 'configuration-required'
  | 'permission-required'
  | 'unsupported'
  | 'unhealthy'
  | 'stale'
  | 'blocked'
  | 'deferred';

export interface ConversationalRuntimeGuardPort {
  getRuntimeStatus(adapterId: string): Promise<ConversationalRuntimeGuardStatus>;
}
