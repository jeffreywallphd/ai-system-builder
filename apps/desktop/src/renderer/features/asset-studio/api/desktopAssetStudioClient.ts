import type { AssetStudioClient } from "../../../../../../../modules/ui/shared/asset-studio";
import type { AssetStudioResult } from "../../../../../../../modules/contracts/asset-studio";
import { getDesktopApi } from "../../../lib/desktopApi";

const unavailable = <T,>(): AssetStudioResult<T> => ({ ok: false, error: { code: "unavailable", message: "Asset Studio is unavailable." } });
const unwrap = <T,>(response: unknown): AssetStudioResult<T> => { const value = response as any; return value?.ok ? { ok: true, value: value.value as T } : { ok: false, error: { code: value?.error?.code ?? "internal", message: value?.error?.message ?? "The Asset Studio request failed." } }; };

export function createDesktopAssetStudioClient(): AssetStudioClient {
  const api = getDesktopApi();
  return {
    start: async (input) => api.startAssetStudio ? unwrap(await api.startAssetStudio(input as never)) : unavailable(),
    propose: async (input) => api.proposeAssetStudioChange ? unwrap(await api.proposeAssetStudioChange(input as never)) : unavailable(),
    review: async (input) => api.reviewAssetStudioProposal ? unwrap(await api.reviewAssetStudioProposal(input as never)) : unavailable(),
    list: async (workspaceId) => api.listAssetStudioWorkflows ? unwrap(await api.listAssetStudioWorkflows(workspaceId)) : unavailable(),
  };
}
