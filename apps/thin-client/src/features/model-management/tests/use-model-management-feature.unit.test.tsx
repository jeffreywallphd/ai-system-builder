import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useModelManagementFeature } from '../hooks/useModelManagementFeature';

function flush() { return new Promise((r) => setTimeout(r, 0)); }

describe('useModelManagementFeature', () => {
  let root: Root | undefined; let container: HTMLDivElement | undefined;
  afterEach(async () => { if (root) await act(async()=>root?.unmount()); container?.remove(); });

  it('trims browse query and does not call details with empty modelId', async () => {
    const client:any={listModels:vi.fn().mockResolvedValue({models:[]}),browseModels:vi.fn().mockResolvedValue({models:[]}),getModelDetails:vi.fn().mockResolvedValue({model:{}}),saveModelReference:vi.fn(),downloadModel:vi.fn(),deleteModelRecord:vi.fn()};
    let vm:any;
    function T(){ vm = useModelManagementFeature(client); return null; }
    container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container);
    await act(async()=>{root.render(<T/>);});
    await act(async()=>{ vm.setQuery('  abc  '); await vm.browse(); await vm.viewDetails('   '); });
    expect(client.browseModels).toHaveBeenCalledWith(expect.objectContaining({query:'abc'}));
    expect(client.getModelDetails).not.toHaveBeenCalled();
  });

  it('newer browse response wins over stale response', async () => {
    let resolveOld:any; let resolveNew:any;
    const oldPromise = new Promise((r)=>{resolveOld=r;});
    const newPromise = new Promise((r)=>{resolveNew=r;});
    const browseModels=vi.fn().mockReturnValueOnce(oldPromise).mockReturnValueOnce(newPromise);
    const client:any={listModels:vi.fn().mockResolvedValue({models:[]}),browseModels,getModelDetails:vi.fn(),saveModelReference:vi.fn(),downloadModel:vi.fn(),deleteModelRecord:vi.fn()};
    let vm:any; function T(){ vm = useModelManagementFeature(client); return null; }
    container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container);
    await act(async()=>{root.render(<T/>);});
    await act(async()=>{vm.setQuery('old'); vm.browse(); vm.setQuery('new'); vm.browse();});
    await act(async()=>{resolveNew({models:[{modelId:'new',displayName:'New',provider:'huggingface'}]}); await flush();});
    await act(async()=>{resolveOld({models:[{modelId:'old',displayName:'Old',provider:'huggingface'}]}); await flush();});
    expect(vm.browseResults[0].modelId).toBe('new');
  });
});
