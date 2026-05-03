import { describe,it,expect,vi } from 'vitest';
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApiImageGenerationClient } from '../api/apiImageGenerationClient';

describe('apiImageGenerationClient',()=>{
 it('preserves failure envelope', async ()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:false,error:{code:'unmanaged-install-root',message:'ComfyUI install failed',details:{x:1}}}),{status:500})));
  const c=createApiImageGenerationClient('/api'); const r=await c.startImageGeneration({prompt:'x'});
 expect(r.ok).toBe(false); if(!r.ok){expect(r.error.code).toBe('unmanaged-install-root'); expect(r.error.httpStatus).toBe(500);} 
 });

 it("does not import runtime adapter internals from thin-client API client", () => {
  const source = readFileSync(resolve("apps/thin-client/src/features/image-generation/api/apiImageGenerationClient.ts"), "utf8");
  expect(source).not.toContain("modules/adapters/runtime");
  expect(source).not.toContain("PYTHON_RUNTIME");
  expect(source).not.toContain(".venv");
 });
});
