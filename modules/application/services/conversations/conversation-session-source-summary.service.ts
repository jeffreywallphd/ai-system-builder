import type { ConversationSessionRecord } from '../../../contracts/conversations';
import type { ConversationSystemSourceSummaryReadModel } from './conversation-read-model-types';
export class ConversationSessionSourceSummaryService {
  summarize(session: ConversationSessionRecord): ConversationSystemSourceSummaryReadModel {
    const basedOnReusableConversationalSystem = Boolean(session.sourceCompositionPlanId);
    return { systemLabel: session.systemLabel, sourceExecutionPlanId: session.sourceExecutionPlanId, sourceCompositionPlanId: session.sourceCompositionPlanId, sourceRuntimeReadinessBindingId: session.sourceRuntimeReadinessBindingId, basedOnReusableConversationalSystem, summary: basedOnReusableConversationalSystem ? 'Customized from a reusable conversational system.' : 'Conversational source metadata unavailable.' };
  }
}
