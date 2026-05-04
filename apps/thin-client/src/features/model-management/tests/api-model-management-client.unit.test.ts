import { describe,it,expect,vi } from 'vitest';
import { createApiModelManagementClient, ModelManagementApiError } from '../api/apiModelManagementClient';

describe('api model management client',()=>{
 it('calls browse endpoint and parses success', async()=>{
  const fetchMock=vi.fn().mockResolvedValue({headers:{get:()=> 'application/json'},status:200,json:vi.fn().mockResolvedValue({ok:true,value:{models:[{modelId:'a',displayName:'A',provider:'huggingface'}]}})});
  vi.stubGlobal('fetch', fetchMock);
  const client=createApiModelManagementClient();
  const res=await client.browseModels({provider:'huggingface',query:'a'});
  expect(fetchMock).toHaveBeenCalledWith('/api/model/browse', expect.objectContaining({headers: expect.objectContaining({'x-client-source':'thin-client.model-management'})}));
  expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).not.toHaveProperty('source', 'thin-client.model-management');
  expect(res.models).toHaveLength(1);
 });
 it('listModels provider filter does not inject telemetry source', async()=>{
  const fetchMock=vi.fn().mockResolvedValue({headers:{get:()=> 'application/json'},status:200,json:vi.fn().mockResolvedValue({ok:true,value:{models:[]}})});
  vi.stubGlobal('fetch', fetchMock);
  await createApiModelManagementClient().listModels({provider:'huggingface'});
  expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({provider:'huggingface'});
 });
 it('listModels preserves valid contract source filter', async()=>{
  const fetchMock=vi.fn().mockResolvedValue({headers:{get:()=> 'application/json'},status:200,json:vi.fn().mockResolvedValue({ok:true,value:{models:[]}})});
  vi.stubGlobal('fetch', fetchMock);
  await createApiModelManagementClient().listModels({source:'huggingface'});
  expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({source:'huggingface'});
 });
 it('throws on failure envelope with code/details', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({headers:{get:()=> 'application/json'},status:400,json:vi.fn().mockResolvedValue({ok:false,error:{message:'bad',code:'validation',details:{field:'provider'}}})}));
  await expect(createApiModelManagementClient().listModels()).rejects.toMatchObject({message:'bad', code:'validation', details:{field:'provider'}});
 });
 it('throws on non-json response', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({headers:{get:()=> 'text/plain'},status:500,json:vi.fn().mockRejectedValue(new Error('x'))}));
  await expect(createApiModelManagementClient().listModels()).rejects.toBeInstanceOf(ModelManagementApiError);
 });
 it('throws on malformed success payload', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({headers:{get:()=> 'application/json'},status:200,json:vi.fn().mockResolvedValue({ok:true,value:{models:'oops'}})}));
  await expect(createApiModelManagementClient().listModels()).rejects.toThrow('missing models array');
 });
});
