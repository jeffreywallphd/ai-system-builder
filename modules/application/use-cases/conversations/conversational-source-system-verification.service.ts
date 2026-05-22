import type { ExecutionPlanRecord } from '../../../contracts/execution-plans';

export type ConversationalSourceVerification = { ok: true } | { ok: false; code: string; message: string };

export class ConversationalSourceSystemVerificationService {
  public verify(plan: ExecutionPlanRecord): ConversationalSourceVerification {
    if (!plan.sourceCompositionPlanId) return { ok: false, code: 'conversational-source-system-missing', message: 'Source composition plan reference is missing.' };
    const hasGenerateText = plan.steps.some((step) => step.kind === 'generate-text');
    if (!hasGenerateText) return { ok: false, code: 'conversational-system-requirement-missing', message: 'Conversational execution requires a generate-text step.' };
    const hasTextRuntimeRequirement = plan.adapterReferences.some((ref) => ref.capabilityKind === 'text-generation' || ref.kind === 'provider-capability');
    if (!hasTextRuntimeRequirement) return { ok: false, code: 'text-generation-runtime-requirement-missing', message: 'Text-generation runtime requirement evidence is missing.' };
    return { ok: true };
  }
}
