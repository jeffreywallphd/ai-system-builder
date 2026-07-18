import type { SystemBuilderClient, SystemBuilderAssetOption } from "../../../../../../../modules/ui/shared/system-builder";
import type { SystemBuilderResult } from "../../../../../../../modules/contracts/system-builder";
import { getDesktopApi } from "../../../lib/desktopApi";
import { createDesktopAssetLibraryClient } from "../../asset-library/api/desktopAssetLibraryClient";

const unavailable = <T,>(message = "System Builder is unavailable."): SystemBuilderResult<T> => ({ ok: false, error: { code: "unavailable", message } });
const unwrap = <T,>(response: unknown): SystemBuilderResult<T> => {
  const value = response as any;
  return value?.ok ? { ok: true, value: value.value as T } : unavailable(value?.error?.message ?? "The System Builder request failed.");
};

export function createDesktopSystemBuilderClient(): SystemBuilderClient {
  const api = getDesktopApi();
  const assets = createDesktopAssetLibraryClient();
  return {
    list: async (input) => typeof api.listSystemBuilderSystems === "function" ? unwrap(await api.listSystemBuilderSystems(input)) : unavailable(),
    create: async (input) => typeof api.createSystemBuilderSystem === "function" ? unwrap(await api.createSystemBuilderSystem(input)) : unavailable(),
    listTemplates: async () => typeof api.listSystemBuilderTemplates === "function" ? unwrap(await api.listSystemBuilderTemplates({})) : unavailable(),
    createFromTemplate: async (input) => typeof api.createSystemBuilderFromTemplate === "function" ? unwrap(await api.createSystemBuilderFromTemplate(input)) : unavailable(),
    readRevision: async (input) => typeof api.readSystemBuilderRevision === "function" ? unwrap(await api.readSystemBuilderRevision(input)) : unavailable(),
    saveRevision: async (input) => typeof api.saveSystemBuilderRevision === "function" ? unwrap(await api.saveSystemBuilderRevision(input)) : unavailable(),
    archive: async (input) => typeof api.archiveSystemBuilderSystem === "function" ? unwrap(await api.archiveSystemBuilderSystem(input)) : unavailable(),
    restore: async (input) => typeof api.restoreSystemBuilderSystem === "function" ? unwrap(await api.restoreSystemBuilderSystem(input)) : unavailable(),
    clone: async (input) => typeof api.cloneSystemBuilderSystem === "function" ? unwrap(await api.cloneSystemBuilderSystem(input)) : unavailable(),
    listRevisions: async (input) => typeof api.listSystemBuilderRevisions === "function" ? unwrap(await api.listSystemBuilderRevisions(input)) : unavailable(),
    async listAssetOptions(workspaceId) {
      const result = await assets.listAssetDefinitions({ workspaceId, limit: 200 });
      if (!result.ok) return unavailable(result.error.message);
      const options: readonly SystemBuilderAssetOption[] = result.value.items.map((asset) => ({ definitionId: asset.definitionId, version: asset.version, displayName: asset.displayName, ...(asset.summary ? { summary: asset.summary } : {}), ...(asset.categoryLabel ? { category: asset.categoryLabel } : {}) }));
      return { ok: true, value: options };
    },
  };
}
