import type { ConversationProvenanceEntry } from '../../../contracts/conversations';

export const createConversationSessionProvenance = (
  kind: string,
  at: string,
  actor = 'application'
): ConversationProvenanceEntry => ({ at, kind, actor });
