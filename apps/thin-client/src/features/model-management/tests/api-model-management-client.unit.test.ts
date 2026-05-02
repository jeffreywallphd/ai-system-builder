import { describe,it,expect,vi } from 'vitest';
import { createApiModelManagementClient, ModelManagementApiError } from '../api/apiModelManagementClient';

describe('api model management client',()=>{
 it('calls browse endpoint and parses success', async()=>{
  const fetchMock=vi.fn().mockResolvedValue({json:vi.fn().mockResolvedValue({ok:true,value:{models:[{modelId:'a',displayName:'A',provider:'huggingface'}]}})});
  vi.stubGlobal('fetch', fetchMock);
  const client=createApiModelManagementClient();
  const res=await client.browseModels({provider:'huggingface',query:'a'});
  expect(fetchMock).toHaveBeenCalledWith('/api/model/browse', expect.anything());
  expect(res.models).toHaveLength(1);
 });
 it('throws on failure envelope with code/details', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:vi.fn().mockResolvedValue({ok:false,error:{message:'bad',code:'validation',details:{field:'provider'}}})}));
  await expect(createApiModelManagementClient().listModels()).rejects.toMatchObject({message:'bad', code:'validation', details:{field:'provider'}});
 });
 it('throws on non-json response', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:vi.fn().mockRejectedValue(new Error('x'))}));
  await expect(createApiModelManagementClient().listModels()).rejects.toBeInstanceOf(ModelManagementApiError);
 });
 it('throws on malformed success payload', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:vi.fn().mockResolvedValue({ok:true,value:{models:'oops'}})}));
  await expect(createApiModelManagementClient().listModels()).rejects.toThrow('missing models array');
 });
});
