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
    expect(d.ok === true ? '' : d.error.code).toBe('unavailable');
    expect(o.ok === true ? '' : o.error.code).toBe('conflict');
    expect(listAuthoredAssets).toHaveBeenCalledWith({workspaceId:'w1'});
    expect(listAssetDrafts).toHaveBeenCalledWith({targetWorkspaceId:'w1'});
  });
  it('sends canonical draft editable command fields', async()=>{
    const createAssetDraft=vi.fn().mockResolvedValue({status:'success',payload:{}});
    const updateAssetDraft=vi.fn().mockResolvedValue({status:'success',payload:{}});
    (window as any).desktopApi={createAssetDraft,updateAssetDraft};
    const c=createDesktopAssetAuthoringClient();
    await c.createDraft({workspaceId:'w1',displayName:'Draft Name',summary:'Summary'});
    await c.updateDraft({workspaceId:'w1',draftId:'d1',summary:'Updated'});
    expect(createAssetDraft).toHaveBeenCalledWith({targetWorkspaceId:'w1',draftEditableValues:{'display-name':'Draft Name',summary:'Summary',description:undefined}});
    expect(updateAssetDraft).toHaveBeenCalledWith({targetWorkspaceId:'w1',draftId:'d1',draftEditablePatch:{'display-name':undefined,summary:'Updated',description:undefined}});
  });
});
