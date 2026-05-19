// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const client = {
  listAuthoredAssets: vi.fn(), listDrafts: vi.fn(), listOverrides: vi.fn(), listEffectiveSummaries: vi.fn(),
  createDraft: vi.fn(), updateDraft: vi.fn(), publishDraft: vi.fn(), disableOverride: vi.fn(),
};
vi.mock('../api/desktopAssetAuthoringClient', () => ({ createDesktopAssetAuthoringClient: () => client }));
import { AssetAuthoringFeature } from '../components/AssetAuthoringFeature';

describe('AssetAuthoringFeature desktop', () => {
  afterEach(() => vi.resetAllMocks());
  it('renders deferred summaries message and result-aware actions', async () => {
    client.listAuthoredAssets.mockResolvedValue({ ok: true, value: { items: [{ authoredAssetId: 'a1', status: 'active', editableFields: { displayName: 'Writer Agent' } }] } });
    client.listDrafts.mockResolvedValue({ ok: true, value: { items: [{ draftId: 'd1', status: 'draft', editableFields: { displayName: 'Draft One' } }] } });
    client.listOverrides.mockResolvedValue({ ok: true, value: { items: [{ overrideId: 'o1', status: 'active', displayLabel: 'Custom One' }] } });
    client.listEffectiveSummaries.mockResolvedValue({ ok: false, error: { code: 'unavailable', message: 'nope' } });
    client.updateDraft.mockResolvedValue({ ok: false, error: { code: 'validation', message: 'bad update' } });
    const c = document.createElement('div'); document.body.appendChild(c);
    const root = createRoot(c);
    await act(async () => { root.render(<AssetAuthoringFeature workspaceId='w1' />); });
    expect(c.textContent).toContain('Workspace usage summaries are not available yet.');
    expect(c.textContent).toContain('Writer Agent');
    const btn = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes('Save safe edit'));
    await act(async () => { btn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(c.textContent).toContain('bad update');
    expect(c.textContent).not.toContain('Draft updated.');
    root.unmount(); c.remove();
  });
});
