type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const fail = (message: string, code = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const asResult = <T,>(v: unknown): Result<T> => { const r=v as any; return r?.ok===true?{ok:true,value:r.value as T}:fail(r?.error?.message ?? 'Unable to complete request.', r?.error?.code ?? 'internal'); };
const api = (): any => ((globalThis as any).window?.desktopApi ?? {});
export function createDesktopExecutionPlansClient() { return {
  async createExecutionPlan(input:{workspaceId:string;runtimeReadinessBindingId:string}) { if(!input.workspaceId||!input.runtimeReadinessBindingId) return fail('Workspace id and runtime readiness binding id are required.','validation'); if(typeof api().createExecutionPlan!=='function') return fail('Execution plan creation is not available yet.','unavailable'); return asResult(await api().createExecutionPlan(input)); },
  async validateExecutionPlan(input:{workspaceId:string;executionPlanId:string}) { if(!input.workspaceId||!input.executionPlanId) return fail('Workspace id and execution plan id are required.','validation'); if(typeof api().validateExecutionPlan!=='function') return fail('Execution plan validation is not available yet.','unavailable'); return asResult(await api().validateExecutionPlan(input)); },
};}
