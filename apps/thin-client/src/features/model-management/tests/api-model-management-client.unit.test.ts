import { describe,it,expect,vi } from 'vitest';
import { createApiModelManagementClient } from '../api/apiModelManagementClient';

describe('api model management client',()=>{
 it('calls browse endpoint and parses success', async()=>{
  const fetchMock=vi.fn().mockResolvedValue({json:vi.fn().mockResolvedValue({ok:true,value:{models:[{modelId:'a',displayName:'A',provider:'huggingface'}]}})});
  vi.stubGlobal('fetch', fetchMock);
  const client=createApiModelManagementClient();
  const res=await client.browseModels({provider:'huggingface',query:'a'});
  expect(fetchMock).toHaveBeenCalledWith('/api/model/browse', expect.anything());
  expect(res.models).toHaveLength(1);
 });
 it('throws on failure envelope', async()=>{
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:vi.fn().mockResolvedValue({ok:false,error:{message:'bad',code:'validation'}})}));
  await expect(createApiModelManagementClient().listModels()).rejects.toThrow('bad');
 });
});
