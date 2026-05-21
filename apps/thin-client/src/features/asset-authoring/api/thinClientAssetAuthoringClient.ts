import { parseApiEnvelope } from '../../../security/apiErrorEnvelope';
import { secureFetch } from '../../../security/secureFetch';
import type { AssetAuthoringEffectiveSourceSummary, AssetOverrideRecord, AuthoredAssetDraftRecord, AuthoredAssetRecord } from '../../../../../modules/contracts/asset-authoring';

type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
type FailureCode = 'unavailable' | 'conflict' | 'not-found' | 'validation' | 'internal';
type EnvelopeSuccess<T> = { status: 'success'; payload: T };
type EnvelopeFailure = { status: 'error'; error?: { code?: string; message?: string } };

type Envelope<T> = EnvelopeSuccess<T> | EnvelopeFailure;
const fail = (message: string, code: FailureCode = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const isFailureCode = (value: unknown): value is FailureCode => ['unavailable', 'conflict', 'not-found', 'validation', 'internal'].includes(String(value));
const unwrap = <T,>(response: unknown): Result<T> => {
  const envelope = response as Envelope<T>;
  if (envelope?.status === 'success') return { ok: true, value: envelope.payload };
  const code = isFailureCode(envelope?.error?.code) ? envelope.error.code : 'internal';
  return fail(typeof envelope?.error?.message === 'string' ? envelope.error.message : 'Unable to complete request.', code);
};

const get = async (url: string) => parseApiEnvelope(await (await secureFetch(url, { method: 'GET' })).json());
const request = async (url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') =>
  parseApiEnvelope(await (await secureFetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json());

export function createThinClientAssetAuthoringClient(base = '/api') {
  const b = base.replace(/\/+$/, '');
  return {
    async listAuthoredAssets(workspaceId: string): Promise<Result<{ items: readonly AuthoredAssetRecord[] }>> {
      try {
        const r = unwrap<{ assets: readonly AuthoredAssetRecord[] }>(await get(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/authored-assets`));
        return r.ok ? { ok: true, value: { items: r.value.assets ?? [] } } : r;
      } catch { return fail('Unable to load custom assets.'); }
    },
    async listDrafts(workspaceId: string): Promise<Result<{ items: readonly AuthoredAssetDraftRecord[] }>> {
      try {
        const r = unwrap<{ drafts: readonly AuthoredAssetDraftRecord[] }>(await get(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/drafts`));
        return r.ok ? { ok: true, value: { items: r.value.drafts ?? [] } } : r;
      } catch { return fail('Unable to load drafts.'); }
    },
    async createDraft(i: { workspaceId: string; displayName: string; summary?: string; description?: string }) {
      try { return unwrap(await request(`${b}/asset-authoring/workspaces/${encodeURIComponent(i.workspaceId)}/drafts`, { editableFields: { displayName: i.displayName, summary: i.summary, description: i.description } })); } catch { return fail('Unable to create draft.'); }
    },
    async updateDraft(i: { workspaceId: string; draftId: string; displayName?: string; summary?: string; description?: string }) {
      try { return unwrap(await request(`${b}/asset-authoring/workspaces/${encodeURIComponent(i.workspaceId)}/drafts/${encodeURIComponent(i.draftId)}`, { editableFieldsPatch: { displayName: i.displayName, summary: i.summary, description: i.description } }, 'PATCH')); } catch { return fail('Unable to update draft.'); }
    },
    async publishDraft(workspaceId: string, draftId: string) {
      try { return unwrap(await request(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/drafts/${encodeURIComponent(draftId)}/publish`, {})); } catch { return fail('Unable to publish draft.'); }
    },
    async listOverrides(workspaceId: string): Promise<Result<{ items: readonly AssetOverrideRecord[] }>> {
      try {
        const r = unwrap<{ overrides: readonly AssetOverrideRecord[] }>(await get(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/overrides`));
        return r.ok ? { ok: true, value: { items: r.value.overrides ?? [] } } : r;
      } catch { return fail('Unable to load customizations.'); }
    },
    async disableOverride(workspaceId: string, overrideId: string) {
      try { return unwrap(await request(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/overrides/${encodeURIComponent(overrideId)}/disable`, {})); } catch { return fail('Unable to disable customization.'); }
    },
    async listEffectiveSummaries(workspaceId: string): Promise<Result<{ items: readonly AssetAuthoringEffectiveSourceSummary[] }>> {
      try {
        const r = unwrap<{ items?: readonly AssetAuthoringEffectiveSourceSummary[]; summaries?: readonly AssetAuthoringEffectiveSourceSummary[] }>(await get(`${b}/asset-authoring/workspaces/${encodeURIComponent(workspaceId)}/effective-summaries`));
        if (!r.ok) return r;
        return { ok: true, value: { items: r.value.items ?? r.value.summaries ?? [] } };
      } catch { return fail('Workspace usage summaries are not available yet.', 'unavailable'); }
    },
  };
}
