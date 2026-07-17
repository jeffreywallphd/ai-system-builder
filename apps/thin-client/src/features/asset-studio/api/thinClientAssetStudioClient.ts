import type { AssetStudioClient } from "../../../../../../modules/ui/shared/asset-studio";
import type { AssetStudioResult } from "../../../../../../modules/contracts/asset-studio";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

const failure = <T,>(message = "Asset Studio is unavailable.", code = "unavailable"): AssetStudioResult<T> => ({ ok: false, error: { code, message } });
async function request<T>(url: string, init?: RequestInit): Promise<AssetStudioResult<T>> { try { const response = await secureFetch(url, init); const envelope = parseApiEnvelope(await response.json()) as any; return envelope.ok ? { ok: true, value: envelope.value as T } : failure(envelope.error?.message ?? "The request failed.", envelope.error?.code ?? "internal"); } catch { return failure(); } }
const post = <T,>(url: string, body: unknown) => request<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function createThinClientAssetStudioClient(baseUrl = "/api"): AssetStudioClient {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    start: (input) => post(`${root}/asset-studio/start`, input),
    propose: (input) => post(`${root}/asset-studio/propose`, input),
    review: (input) => post(`${root}/asset-studio/review`, input),
    list: (workspaceId) => request(`${root}/asset-studio/workflows?workspaceId=${encodeURIComponent(workspaceId)}`),
  };
}
