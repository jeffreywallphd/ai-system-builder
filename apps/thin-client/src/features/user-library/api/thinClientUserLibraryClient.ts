import { parseApiEnvelope } from '../../../security/apiErrorEnvelope';
import { secureFetch } from '../../../security/secureFetch';

type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const e = (message: string): Result<never> => ({ ok: false, error: { code: 'internal', message } });
const unwrap = <T,>(envelope: any): Result<T> => envelope?.ok === true ? { ok: true, value: envelope.value as T } : { ok: false, error: { code: envelope?.error?.code ?? 'internal', message: envelope?.error?.message ?? 'Unable to complete request.' } };

async function getJson(url: string) { const r = await secureFetch(url, { method: 'GET' }); return parseApiEnvelope(await r.json()); }
async function postJson(url: string, body: unknown) { const r = await secureFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return parseApiEnvelope(await r.json()); }

export function createThinClientUserLibraryClient(apiBaseUrl = '/api') {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return {
    async listAssets(): Promise<Result<{ items: any[] }>> { try { return unwrap(await getJson(`${base}/user-library/assets`)); } catch { return e('Unable to read saved reusable assets.'); } },
    async listLinks(workspaceId: string): Promise<Result<{ items: any[] }>> { try { return unwrap(await getJson(`${base}/workspaces/${encodeURIComponent(workspaceId)}/user-library/links`)); } catch { return e('Unable to read workspace library links.'); } },
    async listEffectiveSources(workspaceId: string): Promise<Result<{ items: any[] }>> { try { return unwrap(await getJson(`${base}/workspaces/${encodeURIComponent(workspaceId)}/effective-asset-sources`)); } catch { return e('Unable to read source summaries.'); } },
    async link(workspaceId: string, ref: { assetId: string; version: string }): Promise<Result<unknown>> { try { return unwrap(await postJson(`${base}/user-library/workspace-links`, { targetWorkspaceId: workspaceId, userLibraryAssetReference: ref, versionSelection: { kind: 'pinned', version: ref.version }, propagationPolicy: 'pinned-version', linkLabel: 'Linked to this workspace' })); } catch { return e('Unable to link asset to this workspace.'); } },
    async copy(workspaceId: string, ref: { assetId: string; version: string }): Promise<Result<unknown>> { try { return unwrap(await postJson(`${base}/workspaces/${encodeURIComponent(workspaceId)}/user-library/copies`, { userLibraryAssetReference: ref })); } catch { return e('Unable to copy asset into this workspace.'); } },
  };
}
