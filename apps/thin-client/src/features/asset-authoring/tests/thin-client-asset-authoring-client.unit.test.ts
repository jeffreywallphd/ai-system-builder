// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { createThinClientAssetAuthoringClient } from '../api/thinClientAssetAuthoringClient';
const resp=(b:unknown)=>({status:200,json:vi.fn().mockResolvedValue(b)});

describe('thinClientAssetAuthoringClient',()=>{
  it('calls workspace routes and keeps route/body aligned',async()=>{
    const f=vi.fn()
      .mockResolvedValueOnce(resp({ok:true,value:{drafts:[]}}))
      .mockResolvedValueOnce(resp({ok:true,value:{}}));
    (globalThis as any).fetch=f;
    const c=createThinClientAssetAuthoringClient('/api');
    const result=await c.listDrafts('w1');
    await c.updateDraft({workspaceId:'w1',draftId:'d1',displayName:'N',summary:'S'});
    expect(result.ok).toBe(true);
    expect(String(f.mock.calls[0][0])).toContain('/asset-authoring/workspaces/w1/drafts');
    expect(String(f.mock.calls[1][0])).toContain('/asset-authoring/workspaces/w1/drafts/d1');
    expect(JSON.parse(String(f.mock.calls[1][1].body)).draftEditablePatch['display-name']).toBe('N');
  });
});
