import { parseApiEnvelope } from '../../../security/apiErrorEnvelope';
import { secureFetch } from '../../../security/secureFetch';

type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const fail = (message: string, code = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const unwrap = <T,>(v: unknown): Result<T> => {
  const r = v as any;
  if (r?.ok === true) return { ok: true, value: r.value as T };
  return fail(r?.error?.message ?? 'Unable to complete request.', r?.error?.code ?? 'internal');
};

const get = async (url: string) => parseApiEnvelope(await (await secureFetch(url, { method: 'GET' })).json());
const post = async (url: string, body: unknown) => parseApiEnvelope(await (await secureFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json());

export function createThinClientRuntimeReadinessClient(base = '/api/runtime-readiness') {
  const b = base.replace(/\/+$/, '');
  return {
    async listInventory(workspaceId: string) {
      if (!workspaceId) return fail('Workspace id is required.', 'validation');
      try { return unwrap(await get(`${b}/workspaces/${encodeURIComponent(workspaceId)}/inventory`)); } catch { return fail('Runtime readiness inventory is unavailable.', 'unavailable'); }
    },
    async refreshInventory(input: { workspaceId: string; sourceKind?: string; sourceId?: string }) {
      if (!input.workspaceId) return fail('Workspace id is required.', 'validation');
      try { return unwrap(await post(`${b}/workspaces/${encodeURIComponent(input.workspaceId)}/inventory/refresh`, { targetWorkspaceId: input.workspaceId, sourceKind: input.sourceKind, sourceId: input.sourceId })); } catch { return fail('Runtime readiness inventory refresh is unavailable.', 'unavailable'); }
    },
    async createBinding(input: { workspaceId: string; compositionPlanId: string }) {
      if (!input.workspaceId || !input.compositionPlanId) return fail('Workspace id and composition plan id are required.', 'validation');
      try { return unwrap(await post(`${b}/workspaces/${encodeURIComponent(input.workspaceId)}/bindings`, { targetWorkspaceId: input.workspaceId, compositionPlanId: input.compositionPlanId })); } catch { return fail('Runtime readiness binding creation is unavailable.', 'unavailable'); }
    },
  };
}
