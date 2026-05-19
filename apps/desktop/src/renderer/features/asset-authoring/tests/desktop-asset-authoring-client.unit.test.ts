// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { createDesktopAssetAuthoringClient } from '../api/desktopAssetAuthoringClient';

describe('desktopAssetAuthoringClient',()=>{
  it('calls preload with explicit workspace ids and parses status/payload envelopes', async()=>{
    const listAuthoredAssets=vi.fn().mockResolvedValue({status:'success',payload:{assets:[]}});
    const listAssetDrafts=vi.fn().mockResolvedValue({status:'success',payload:{drafts:[]}});
    const createAssetDraft=vi.fn().mockResolvedValue({status:'success',payload:{}});
    (window as any).desktopApi={listAuthoredAssets,listAssetDrafts,createAssetDraft};
    const c=createDesktopAssetAuthoringClient();
    const a=await c.listAuthoredAssets('w1');
    const d=await c.listDrafts('w1');
    const cr=await c.createDraft({workspaceId:'w1',displayName:'A'});
    expect(a.ok).toBe(true); expect(d.ok).toBe(true); expect(cr.ok).toBe(true);
    expect(listAuthoredAssets).toHaveBeenCalledWith({workspaceId:'w1'});
    expect(listAssetDrafts).toHaveBeenCalledWith({targetWorkspaceId:'w1'});
    expect(createAssetDraft.mock.calls[0][0].targetWorkspaceId).toBe('w1');
  });
});
