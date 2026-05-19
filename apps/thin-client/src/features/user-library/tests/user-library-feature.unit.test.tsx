// @vitest-environment jsdom
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { UserLibraryFeature } from '../components/UserLibraryFeature';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;

function response(status: number, body: unknown) { return { status, json: vi.fn().mockResolvedValue(body) }; }

describe('thin user-library ui', () => {
  it('renders friendly source labels and deferred note', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce(response(200, { ok: true, value: { assets: [] } }))
      .mockResolvedValueOnce(response(200, { ok: true, value: { links: [] } }))
      .mockResolvedValueOnce(response(200, { ok: true, value: { items: [{ effectiveSourceKind: 'workspace-local', assetReference: { assetId: 'a', version: '1' } }] } }));
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(<UserLibraryFeature workspaceId='ws-1' />); });
    expect(container.textContent).toContain('Created in this workspace');
    expect(container.textContent).toContain('Promote/import flows are deferred');
  });
});
