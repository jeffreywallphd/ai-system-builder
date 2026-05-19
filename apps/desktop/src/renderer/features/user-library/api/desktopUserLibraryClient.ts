import type { UserLibraryAssetRecord, UserLibraryEffectiveSourceSummary, UserLibraryPropagationPolicy, WorkspaceUserLibraryLinkRecord } from '../../../../../../../modules/contracts/user-library';

export type DesktopUserLibraryClientResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
interface DesktopUserLibraryApiBridge { listUserLibraryAssets?: (input?: Record<string, unknown>) => Promise<unknown>; listWorkspaceUserLibraryLinks?: (input: { workspaceId: string }) => Promise<unknown>; linkUserLibraryAssetToWorkspace?: (command: Record<string, unknown>) => Promise<unknown>; copyUserLibraryAssetToWorkspace?: (command: Record<string, unknown>) => Promise<unknown>; readWorkspaceEffectiveAssetSources?: (input: { workspaceId: string }) => Promise<unknown>; }
function getApi(): DesktopUserLibraryApiBridge { return ((globalThis as any).window?.desktopApi ?? {}) as DesktopUserLibraryApiBridge; }
const err = (message: string): DesktopUserLibraryClientResult<never> => ({ ok: false, error: { code: 'internal', message } });
const unwrap = <T,>(response: any): DesktopUserLibraryClientResult<T> => response?.ok === true ? { ok: true, value: response.value as T } : { ok: false, error: { code: response?.error?.code ?? 'internal', message: response?.error?.message ?? 'Unable to complete request.' } };

export function createDesktopUserLibraryClient() {
  const api = getApi();
  return {
    async listAssets(): Promise<DesktopUserLibraryClientResult<{ items: UserLibraryAssetRecord[] }>> { if (typeof api.listUserLibraryAssets !== 'function') return err('Saved reusable assets are unavailable.'); try { return unwrap(await api.listUserLibraryAssets({})); } catch { return err('Unable to read saved reusable assets.'); } },
    async listLinks(workspaceId: string): Promise<DesktopUserLibraryClientResult<{ items: WorkspaceUserLibraryLinkRecord[] }>> { if (typeof api.listWorkspaceUserLibraryLinks !== 'function') return err('Workspace library links are unavailable.'); try { return unwrap(await api.listWorkspaceUserLibraryLinks({ workspaceId })); } catch { return err('Unable to read workspace library links.'); } },
    async listEffectiveSources(workspaceId: string): Promise<DesktopUserLibraryClientResult<{ items: UserLibraryEffectiveSourceSummary[] }>> { if (typeof api.readWorkspaceEffectiveAssetSources !== 'function') return err('Source summaries are unavailable.'); try { return unwrap(await api.readWorkspaceEffectiveAssetSources({ workspaceId })); } catch { return err('Unable to read source summaries.'); } },
    async link(workspaceId: string, ref: { assetId: string; version: string }, propagationPolicy: UserLibraryPropagationPolicy = 'pinned-version'): Promise<DesktopUserLibraryClientResult<unknown>> { if (typeof api.linkUserLibraryAssetToWorkspace !== 'function') return err('Linking is unavailable in this app build.'); return unwrap(await api.linkUserLibraryAssetToWorkspace({ targetWorkspaceId: workspaceId, userLibraryAssetReference: ref, versionSelection: { kind: 'pinned', version: ref.version }, propagationPolicy, linkLabel: 'Linked to this workspace' })); },
    async copy(workspaceId: string, ref: { assetId: string; version: string }): Promise<DesktopUserLibraryClientResult<unknown>> { if (typeof api.copyUserLibraryAssetToWorkspace !== 'function') return err('Copying is unavailable in this app build.'); return unwrap(await api.copyUserLibraryAssetToWorkspace({ targetWorkspaceId: workspaceId, userLibraryAssetReference: ref })); },
  };
}
