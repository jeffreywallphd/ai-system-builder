import { describe,it,expect,vi } from 'vitest';
import { createApiImageGenerationClient } from '../api/apiImageGenerationClient';

describe('apiImageGenerationClient',()=>{
 it('start/read/cancel/finalize sends x-client-source header and no source in body', async ()=>{
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ok:true,value:{requestId:'r1'}}),{status:200}));
  vi.stubGlobal('fetch', fetchMock);
  const c=createApiImageGenerationClient('/api');
  await c.startImageGeneration({prompt:'x'} as any);
  await c.readImageGeneration('r1');
  await c.cancelImageGeneration('r1');
  await c.finalizeImageGeneration('r1');
  for (const call of fetchMock.mock.calls) {
    const options = call[1] as RequestInit;
    expect((options.headers as Record<string,string>)['x-client-source']).toBe('thin-client.image-generation');
    expect(String(options.body)).not.toContain('"source"');
  }
 });

 it('preserves failure envelope including code/details/status/endpoint', async ()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:false,error:{code:'unmanaged-install-root',message:'ComfyUI install failed',details:{x:1}}}),{status:500})));
  const c=createApiImageGenerationClient('/api'); const r=await c.startImageGeneration({prompt:'x'} as any);
  expect(r.ok).toBe(false); if(!r.ok){expect(r.error.code).toBe('unmanaged-install-root'); expect(r.error.status).toBe(500); expect(r.error.endpoint).toBe('/image-generation/start'); expect(r.error.details).toEqual({x:1});}
 });

 it('returns non-json-response with endpoint/status details', async ()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>bad</html>',{status:502})));
  const c=createApiImageGenerationClient('/api'); const r=await c.readImageGeneration('r1');
  expect(r.ok).toBe(false); if(!r.ok){expect(r.error.code).toBe('non-json-response'); expect(r.error.status).toBe(502); expect(r.error.endpoint).toBe('/image-generation/read');}
 });
});
