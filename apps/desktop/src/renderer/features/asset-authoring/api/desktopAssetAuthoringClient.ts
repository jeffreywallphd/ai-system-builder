import type { AssetAuthoringEffectiveSourceSummary, AssetOverrideRecord, AuthoredAssetDraftRecord, AuthoredAssetRecord } from '../../../../../../../modules/contracts/asset-authoring';

type FailureCode = 'unavailable' | 'conflict' | 'not-found' | 'validation' | 'internal';
type Result<T> = { ok: true; value: T } | { ok: false; error: { code: FailureCode; message: string } };

type EnvelopeSuccess<T> = { status: 'success'; payload: T };
type EnvelopeFailure = { status: 'error'; error?: { code?: string; message?: string } };
type Envelope<T> = EnvelopeSuccess<T> | EnvelopeFailure;

type Api = {
  listAuthoredAssets?: (i: { workspaceId: string }) => Promise<unknown>;
  listAssetDrafts?: (i: { targetWorkspaceId: string }) => Promise<unknown>;
  createAssetDraft?: (i: { targetWorkspaceId: string; draftEditableValues: { "display-name": string; summary?: string; description?: string } }) => Promise<unknown>;
  updateAssetDraft?: (i: { targetWorkspaceId: string; draftId: string; draftEditablePatch: { "display-name"?: string; summary?: string; description?: string } }) => Promise<unknown>;
  publishAssetDraft?: (i: { targetWorkspaceId: string; draftId: string }) => Promise<unknown>;
  listAssetOverrides?: (i: { targetWorkspaceId: string }) => Promise<unknown>;
  disableAssetOverride?: (i: { targetWorkspaceId: string; overrideId: string }) => Promise<unknown>;
  listAssetAuthoringEffectiveSummaries?: (i: { targetWorkspaceId: string }) => Promise<unknown>;
};

const fail = (message: string, code: FailureCode = 'internal'): Result<never> => ({ ok: false, error: { code, message } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isFailureCode = (value: unknown): value is FailureCode => ['unavailable', 'conflict', 'not-found', 'validation', 'internal'].includes(String(value));

const parseEnvelope = <T,>(response: unknown): Result<T> => {
  if (!isRecord(response) || (response.status !== 'success' && response.status !== 'error')) {
    return fail('Unable to complete request.', 'internal');
  }
  const envelope = response as Envelope<T>;
  if (envelope.status === 'success') return { ok: true, value: envelope.payload };
  const code = isFailureCode(envelope.error?.code) ? envelope.error.code : 'internal';
  const message = typeof envelope.error?.message === 'string' ? envelope.error.message : 'Unable to complete request.';
  return fail(message, code);
};

const getApi = (): Api => ((globalThis as { window?: { desktopApi?: Api } }).window?.desktopApi ?? {});

export function createDesktopAssetAuthoringClient() {
  const api = getApi();
  return {
    async listAuthoredAssets(workspaceId: string): Promise<Result<{ items: readonly AuthoredAssetRecord[] }>> {
      if (typeof api.listAuthoredAssets !== 'function') return fail('Custom assets are not available yet.', 'unavailable');
      const r = parseEnvelope<{ assets: readonly AuthoredAssetRecord[] }>(await api.listAuthoredAssets({ workspaceId }));
      if (r.ok === true) return { ok: true, value: { items: r.value.assets ?? [] } };
      return fail(r.error.message, r.error.code);
    },
    async listDrafts(workspaceId: string): Promise<Result<{ items: readonly AuthoredAssetDraftRecord[] }>> {
      if (typeof api.listAssetDrafts !== 'function') return fail('Drafts are not available yet.', 'unavailable');
      const r = parseEnvelope<{ drafts: readonly AuthoredAssetDraftRecord[] }>(await api.listAssetDrafts({ targetWorkspaceId: workspaceId }));
      if (r.ok === true) return { ok: true, value: { items: r.value.drafts ?? [] } };
      return fail(r.error.message, r.error.code);
    },
    async createDraft(input: { workspaceId: string; displayName: string; summary?: string; description?: string }): Promise<Result<unknown>> {
      if (typeof api.createAssetDraft !== 'function') return fail('Create draft is not available yet.', 'unavailable');
      return parseEnvelope(await api.createAssetDraft({ targetWorkspaceId: input.workspaceId, draftEditableValues: { "display-name": input.displayName, summary: input.summary, description: input.description } }));
    },
    async updateDraft(input: { workspaceId: string; draftId: string; displayName?: string; summary?: string; description?: string }): Promise<Result<unknown>> {
      if (typeof api.updateAssetDraft !== 'function') return fail('Update draft is not available yet.', 'unavailable');
      return parseEnvelope(await api.updateAssetDraft({ targetWorkspaceId: input.workspaceId, draftId: input.draftId, draftEditablePatch: { "display-name": input.displayName, summary: input.summary, description: input.description } }));
    },
    async publishDraft(workspaceId: string, draftId: string): Promise<Result<unknown>> {
      if (typeof api.publishAssetDraft !== 'function') return fail('Publish draft is not available yet.', 'unavailable');
      return parseEnvelope(await api.publishAssetDraft({ targetWorkspaceId: workspaceId, draftId }));
    },
    async listOverrides(workspaceId: string): Promise<Result<{ items: readonly AssetOverrideRecord[] }>> {
      if (typeof api.listAssetOverrides !== 'function') return fail('Workspace customizations are not available yet.', 'unavailable');
      const r = parseEnvelope<{ overrides: readonly AssetOverrideRecord[] }>(await api.listAssetOverrides({ targetWorkspaceId: workspaceId }));
      if (r.ok === true) return { ok: true, value: { items: r.value.overrides ?? [] } };
      return fail(r.error.message, r.error.code);
    },
    async disableOverride(workspaceId: string, overrideId: string): Promise<Result<unknown>> {
      if (typeof api.disableAssetOverride !== 'function') return fail('Disable customization is not available yet.', 'unavailable');
      return parseEnvelope(await api.disableAssetOverride({ targetWorkspaceId: workspaceId, overrideId }));
    },
    async listEffectiveSummaries(workspaceId: string): Promise<Result<{ items: readonly AssetAuthoringEffectiveSourceSummary[] }>> {
      if (typeof api.listAssetAuthoringEffectiveSummaries !== 'function') return fail('Workspace usage summaries are not available yet.', 'unavailable');
      const r = parseEnvelope<{ items: readonly AssetAuthoringEffectiveSourceSummary[] }>(await api.listAssetAuthoringEffectiveSummaries({ targetWorkspaceId: workspaceId }));
      if (r.ok === false) return fail(r.error.message, r.error.code);
      return { ok: true, value: { items: r.value.items ?? [] } };
    },
  };
}
