// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { createThinClientAssetAuthoringClient } from '../api/thinClientAssetAuthoringClient';
const resp=(b:unknown)=>({status:200,json:vi.fn().mockResolvedValue(b)});

describe('thinClientAssetAuthoringClient',()=>{
  it('uses workspace scoped routes and parses status/payload envelope',async()=>{
    const f=vi.fn().mockResolvedValue(resp({status:'success',payload:{drafts:[]}}));
    (globalThis as any).fetch=f;
    const c=createThinClientAssetAuthoringClient('/api');
    const result=await c.listDrafts('w1');
    expect(result.ok).toBe(true);
    expect(String(f.mock.calls[0][0])).toContain('/asset-authoring/workspaces/w1/drafts');
  });
});
