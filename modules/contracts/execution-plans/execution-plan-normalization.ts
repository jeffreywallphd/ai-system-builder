import type { ExecutionPlanRecord } from './execution-plan-record';
import { normalizeExecutionPlanId } from './execution-plan-identity';
export function normalizeExecutionPlanRecord(input: ExecutionPlanRecord): ExecutionPlanRecord {
  if (!input.workspaceId?.trim()) throw new Error('Execution plan requires explicit workspaceId.');
  if (!input.sourceRuntimeReadinessBindingId?.trim()) throw new Error('Execution plan requires source runtime readiness binding id.');
  if (!input.sourceCompositionPlanId?.trim()) throw new Error('Execution plan requires source composition plan id.');
  const unsafe = JSON.stringify(input).toLowerCase();
  if (/(secret|token|api key|private key|command|shell|payload|base64|blob|signed url|workflow json)/i.test(unsafe)) throw new Error('Execution plan includes unsafe metadata.');
  return { ...input, id: normalizeExecutionPlanId(input.id), workspaceId: input.workspaceId.trim() };
}
