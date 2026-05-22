type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const fail = (message: string, code = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const asResult = <T,>(v: unknown): Result<T> => { const r=v as {ok?:boolean;value?:T;error?:{message?:string;code?:string}}; return r?.ok===true?{ok:true,value:r.value as T}:fail(r?.error?.message ?? 'Unable to complete request.', r?.error?.code ?? 'internal'); };
type DesktopApiSurface = { desktopApi?: Record<string, unknown> };
const api = (): Record<string, unknown> => ((globalThis as DesktopApiSurface & typeof globalThis).window?.desktopApi ?? {});
const call = async <T,>(name: string, input: unknown, unavailable: string): Promise<Result<T>> => {
  const fn = api()[name];
  if (typeof fn !== 'function') return fail(unavailable, 'unavailable');
  return asResult(await (fn as (payload: unknown) => Promise<unknown>)(input));
};

export function createDesktopExecutionPlansClient() { return {
  async createExecutionPlan(input:{workspaceId:string;runtimeReadinessBindingId:string}) { if(!input.workspaceId||!input.runtimeReadinessBindingId) return fail('Workspace id and runtime readiness binding id are required.','validation'); return call('createExecutionPlan', input, 'Plan preview preparation is not available yet.'); },
  async validateExecutionPlan(input:{workspaceId:string;executionPlanId:string}) { if(!input.workspaceId||!input.executionPlanId) return fail('Workspace id and execution plan id are required.','validation'); return call('validateExecutionPlan', input, 'Preview checking is not available yet.'); },
  async archiveExecutionPlan(input:{workspaceId:string;executionPlanId:string}) { if(!input.workspaceId||!input.executionPlanId) return fail('Workspace id and execution plan id are required.','validation'); return call('archiveExecutionPlan', input, 'Execution plan archive is not available yet.'); },
  async listExecutionPlanSummaries(input:{workspaceId:string; includeArchived?: boolean; limit?: number; cursor?: string; status?: string}) { if(!input.workspaceId) return fail('Workspace id is required.','validation'); return call('listExecutionPlanSummaries', input, 'Execution plan summaries are unavailable.'); },
  async readExecutionPlanDetail(input:{workspaceId:string;executionPlanId:string}) { if(!input.workspaceId||!input.executionPlanId) return fail('Workspace id and execution plan id are required.','validation'); return call('readExecutionPlanDetail', input, 'Plan preview details are not available yet.'); },
  async listExecutionPlansForCompositionPlan(input:{workspaceId:string;compositionPlanId:string; includeArchived?: boolean}) { if(!input.workspaceId||!input.compositionPlanId) return fail('Workspace id and composition plan id are required.','validation'); return call('listExecutionPlansForCompositionPlan', input, 'Plan preview details are not available yet.'); },
  async readLatestExecutionPlanForCompositionPlan(input:{workspaceId:string;compositionPlanId:string; includeArchived?: boolean}) { if(!input.workspaceId||!input.compositionPlanId) return fail('Workspace id and composition plan id are required.','validation'); return call('readLatestExecutionPlanForCompositionPlan', input, 'Plan preview details are not available yet.'); },
  async listExecutionPlansForRuntimeReadinessBinding(input:{workspaceId:string;runtimeReadinessBindingId:string; includeArchived?: boolean}) { if(!input.workspaceId||!input.runtimeReadinessBindingId) return fail('Workspace id and runtime readiness binding id are required.','validation'); return call('listExecutionPlansForRuntimeReadinessBinding', input, 'Plan preview details are not available yet.'); },
  async readLatestExecutionPlanForRuntimeReadinessBinding(input:{workspaceId:string;runtimeReadinessBindingId:string; includeArchived?: boolean}) { if(!input.workspaceId||!input.runtimeReadinessBindingId) return fail('Workspace id and runtime readiness binding id are required.','validation'); return call('readLatestExecutionPlanForRuntimeReadinessBinding', input, 'Plan preview details are not available yet.'); },
  async listExecutionPlansNeedingAttention(input:{workspaceId:string}) { if(!input.workspaceId) return fail('Workspace id is required.','validation'); return call('listExecutionPlansNeedingAttention', input, 'Execution plan summaries are unavailable.'); },
  async summarizeWorkspaceExecutionPlans(input:{workspaceId:string}) { if(!input.workspaceId) return fail('Workspace id is required.','validation'); return call('summarizeWorkspaceExecutionPlans', input, 'Execution plan summaries are unavailable.'); },
};}
