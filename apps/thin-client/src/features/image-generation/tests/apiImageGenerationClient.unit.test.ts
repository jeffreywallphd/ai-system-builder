import { describe,it,expect,vi } from 'vitest';
import { createApiImageGenerationClient } from '../api/apiImageGenerationClient';

describe('apiImageGenerationClient',()=>{
 it('preserves failure envelope', async ()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:false,error:{code:'unmanaged-install-root',message:'ComfyUI install failed',details:{x:1}}}),{status:500})));
  const c=createApiImageGenerationClient('/api'); const r=await c.startImageGeneration({prompt:'x'});
  expect(r.ok).toBe(false); if(!r.ok){expect(r.error.code).toBe('unmanaged-install-root'); expect(r.error.httpStatus).toBe(500);} 
 });
});
