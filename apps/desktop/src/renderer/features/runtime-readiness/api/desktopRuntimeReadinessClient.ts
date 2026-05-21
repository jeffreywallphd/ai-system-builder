type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const fail = (message: string, code = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const asResult = <T,>(v: unknown): Result<T> => {
  const r = v as any;
  if (r?.ok === true) return { ok: true, value: r.value as T };
  return fail(r?.error?.message ?? 'Unable to complete request.', r?.error?.code ?? 'internal');
};

type Api = {
  refreshRuntimeReadinessInventory?: (i: { targetWorkspaceId: string; sourceKind?: string; sourceId?: string }) => Promise<unknown>;
  listRuntimeReadinessInventory?: (i: { targetWorkspaceId: string; limit?: number; cursor?: string }) => Promise<unknown>;
  readRuntimeReadinessInventory?: (i: { targetWorkspaceId: string; inventorySourceId: string }) => Promise<unknown>;
  readLatestRuntimeReadinessInventory?: (i: { targetWorkspaceId: string; sourceKind?: string; sourceId?: string }) => Promise<unknown>;
  summarizeRuntimeReadinessInventory?: (i: { targetWorkspaceId: string }) => Promise<unknown>;
  createRuntimeReadinessBinding?: (i: { targetWorkspaceId: string; compositionPlanId: string }) => Promise<unknown>;
  validateRuntimeReadinessBinding?: (i: { targetWorkspaceId: string; readinessBindingId: string }) => Promise<unknown>;
};

const api = (): Api => ((globalThis as any).window?.desktopApi ?? {});

export function createDesktopRuntimeReadinessClient() {
  return {
    async refreshInventory(input: { workspaceId: string; sourceKind?: string; sourceId?: string }) {
      if (!input.workspaceId) return fail('Workspace id is required.', 'validation');
      if (typeof api().refreshRuntimeReadinessInventory !== 'function') return fail('Runtime readiness inventory refresh is not available yet.', 'unavailable');
      return asResult(await api().refreshRuntimeReadinessInventory!({ targetWorkspaceId: input.workspaceId, sourceKind: input.sourceKind, sourceId: input.sourceId }));
    },
    async listInventory(workspaceId: string) {
      if (!workspaceId) return fail('Workspace id is required.', 'validation');
      if (typeof api().listRuntimeReadinessInventory !== 'function') return fail('Runtime readiness inventory list is not available yet.', 'unavailable');
      return asResult(await api().listRuntimeReadinessInventory!({ targetWorkspaceId: workspaceId }));
    },

    async summarizeInventory(workspaceId: string) {
      if (!workspaceId) return fail('Workspace id is required.', 'validation');
      if (typeof api().summarizeRuntimeReadinessInventory !== 'function') return fail('Runtime readiness inventory summary is not available yet.', 'unavailable');
      return asResult(await api().summarizeRuntimeReadinessInventory!({ targetWorkspaceId: workspaceId }));
    },
    async validateBinding(input: { workspaceId: string; readinessBindingId: string }) {
      if (!input.workspaceId || !input.readinessBindingId) return fail('Workspace id and readiness binding id are required.', 'validation');
      if (typeof api().validateRuntimeReadinessBinding !== 'function') return fail('Runtime readiness binding validation is not available yet.', 'unavailable');
      return asResult(await api().validateRuntimeReadinessBinding!({ targetWorkspaceId: input.workspaceId, readinessBindingId: input.readinessBindingId }));
    },
    async readLatestInventory(input: { workspaceId: string; sourceKind?: string; sourceId?: string }) {
      if (!input.workspaceId) return fail('Workspace id is required.', 'validation');
      if (typeof api().readLatestRuntimeReadinessInventory !== 'function') return fail('Runtime readiness inventory read is not available yet.', 'unavailable');
      return asResult(await api().readLatestRuntimeReadinessInventory!({ targetWorkspaceId: input.workspaceId, sourceKind: input.sourceKind, sourceId: input.sourceId }));
    },
    async createBinding(input: { workspaceId: string; compositionPlanId: string }) {
      if (!input.workspaceId || !input.compositionPlanId) return fail('Workspace id and composition plan id are required.', 'validation');
      if (typeof api().createRuntimeReadinessBinding !== 'function') return fail('Runtime readiness binding creation is not available yet.', 'unavailable');
      return asResult(await api().createRuntimeReadinessBinding!({ targetWorkspaceId: input.workspaceId, compositionPlanId: input.compositionPlanId }));
    },
  };
}
