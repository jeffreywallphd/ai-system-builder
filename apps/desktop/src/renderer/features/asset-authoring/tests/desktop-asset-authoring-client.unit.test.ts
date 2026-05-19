// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { createDesktopAssetAuthoringClient } from '../api/desktopAssetAuthoringClient';

describe('desktopAssetAuthoringClient',()=>{
  it('parses preload envelopes, preserves failure codes, and sends explicit workspace ids', async()=>{
    const listAuthoredAssets=vi.fn().mockResolvedValue({status:'success',payload:{assets:[]}});
    const listAssetDrafts=vi.fn().mockResolvedValue({status:'error',error:{code:'unavailable',message:'no'}});
    const listAssetOverrides=vi.fn().mockResolvedValue({status:'error',error:{code:'conflict',message:'conflict'}});
    (window as any).desktopApi={listAuthoredAssets,listAssetDrafts,listAssetOverrides};
    const c=createDesktopAssetAuthoringClient();
    expect((await c.listAuthoredAssets('w1')).ok).toBe(true);
    const d=await c.listDrafts('w1'); const o=await c.listOverrides('w1');
    expect(d.ok? '':d.error.code).toBe('unavailable');
    expect(o.ok? '':o.error.code).toBe('conflict');
    expect(listAuthoredAssets).toHaveBeenCalledWith({workspaceId:'w1'});
    expect(listAssetDrafts).toHaveBeenCalledWith({targetWorkspaceId:'w1'});
  });
});
