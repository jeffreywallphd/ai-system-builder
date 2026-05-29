import type { ConversationalInvocationRuntimeReference } from './conversation-turn-invocation.port';

export type ConversationalAdapterCapability = { progress: boolean; cancellation: boolean };

export type ConversationalAdapterSelection =
  | { status: 'supported'; adapterId: string; capabilityKind: 'text-generation'; capabilities: ConversationalAdapterCapability }
  | { status: 'deferred' | 'unsupported' | 'unavailable' | 'invalid' | 'blocked' };

export interface ConversationalRuntimeAdapterCatalogPort {
  resolveForRuntime(runtime: ConversationalInvocationRuntimeReference): Promise<ConversationalAdapterSelection>;
}
