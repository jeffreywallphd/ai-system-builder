import type { SystemBuilderClient, SystemBuilderAssetOption } from "../../../../../../modules/ui/shared/system-builder";
import type { SystemBuilderResult } from "../../../../../../modules/contracts/system-builder";
import { createApiAssetLibraryClient } from "../../asset-library/api/apiAssetLibraryClient";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

const failure = <T,>(message = "System Builder is unavailable.", code = "unavailable"): SystemBuilderResult<T> => ({ ok: false, error: { code, message } });
async function request<T>(url: string, init?: RequestInit): Promise<SystemBuilderResult<T>> {
  try {
    const response = await secureFetch(url, init);
    const envelope = parseApiEnvelope(await response.json()) as any;
    return envelope.ok ? { ok: true, value: envelope.value as T } : failure(envelope.error?.message ?? "The request failed.", envelope.error?.code ?? "internal");
  } catch { return failure(); }
}
const post = <T,>(url: string, body: unknown) => request<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function createThinClientSystemBuilderClient(baseUrl = "/api"): SystemBuilderClient {
  const root = baseUrl.replace(/\/+$/, "");
  const assets = createApiAssetLibraryClient({ apiBaseUrl: root });
  return {
    list: (input) => request(`${root}/systems?workspaceId=${encodeURIComponent(input.workspaceId)}&includeArchived=${input.includeArchived === true}`),
    create: (input) => post(`${root}/systems/create`, input),
    listTemplates: () => request(`${root}/systems/templates`),
    createFromTemplate: (input) => post(`${root}/systems/create-from-template`, input),
    readRevision: (input) => request(`${root}/systems/revision?workspaceId=${encodeURIComponent(input.workspaceId)}&systemId=${encodeURIComponent(input.systemId)}${input.revisionId ? `&revisionId=${encodeURIComponent(input.revisionId)}` : ""}`),
    saveRevision: (input) => post(`${root}/systems/revisions/save`, input),
    archive: (input) => post(`${root}/systems/archive`, input),
    restore: (input) => post(`${root}/systems/restore`, input),
    clone: (input) => post(`${root}/systems/clone`, input),
    listRevisions: (input) => request(`${root}/systems/revisions?workspaceId=${encodeURIComponent(input.workspaceId)}&systemId=${encodeURIComponent(input.systemId)}`),
    async listAssetOptions(workspaceId) {
      const result = await assets.listAssetDefinitions({ workspaceId, limit: 200 });
      if (!result.ok) return failure(result.error.message);
      const options: readonly SystemBuilderAssetOption[] = result.value.items.map((asset) => ({ definitionId: asset.definitionId, version: asset.version, displayName: asset.displayName, ...(asset.summary ? { summary: asset.summary } : {}), ...(asset.categoryLabel ? { category: asset.categoryLabel } : {}) }));
      return { ok: true, value: options };
    },
  };
}
