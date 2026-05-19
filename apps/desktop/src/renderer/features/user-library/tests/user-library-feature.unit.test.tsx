// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { UserLibraryFeature } from '../components/UserLibraryFeature';

it('renders friendly source labels and calls link/copy with workspace id', async () => {
  const api = {
    listUserLibraryAssets: vi.fn().mockResolvedValue({ ok: true, value: { assets: [{ userLibraryAssetId: 'a1', version: '1.0.0', displayName: 'Asset 1' }] } }),
    listWorkspaceUserLibraryLinks: vi.fn().mockResolvedValue({ ok: true, value: { links: [{ linkId: 'l1', userLibraryAssetReference: { assetId: 'a1', version: '1.0.0' }, propagationPolicy: 'pinned-version' }] } }),
    readWorkspaceEffectiveAssetSources: vi.fn().mockResolvedValue({ ok: true, value: { items: [{ effectiveSourceKind: 'user-library-linked', assetReference: { assetId: 'x', version: '1' } }] } }),
    linkUserLibraryAssetToWorkspace: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    copyUserLibraryAssetToWorkspace: vi.fn().mockResolvedValue({ ok: true, value: {} }),
  };
  (window as any).desktopApi = api;
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => { root.render(<UserLibraryFeature workspaceId='ws-1' />); });
  expect(container.textContent).toContain('Linked from your reusable library');
  expect(container.textContent).not.toContain('providerPayload');
});
