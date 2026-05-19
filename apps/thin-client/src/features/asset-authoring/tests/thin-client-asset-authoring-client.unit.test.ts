// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { createThinClientAssetAuthoringClient } from '../api/thinClientAssetAuthoringClient';
const resp=(b:unknown)=>({status:200,json:vi.fn().mockResolvedValue(b)});
describe('thinClientAssetAuthoringClient',()=>{it('uses asset-authoring routes with explicit workspace ids',async()=>{const f=vi.fn().mockResolvedValue(resp({ok:true,value:{drafts:[]}})); (globalThis as any).fetch=f; const c=createThinClientAssetAuthoringClient('/api'); await c.listDrafts('w1'); expect(f.mock.calls[0][0]).toContain('targetWorkspaceId=w1');});});
