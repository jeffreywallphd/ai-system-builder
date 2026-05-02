import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelManagementFeature } from '../components/ModelManagementFeature';

describe('ModelManagementFeature',()=>{
 let root:Root|undefined; let container:HTMLDivElement|undefined;
 afterEach(async()=>{ if(root){ await act(async()=>{root?.unmount();}); } container?.remove(); vi.restoreAllMocks(); });

 it('renders browse and inventory sections and supported provider only', async()=>{
  const client:any={listModels:vi.fn().mockResolvedValue({models:[]}),browseModels:vi.fn().mockResolvedValue({models:[]}),getModelDetails:vi.fn(),saveModelReference:vi.fn(),downloadModel:vi.fn(),deleteModelRecord:vi.fn()};
  container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container);
  await act(async()=>{root.render(<ModelManagementFeature client={client}/>);});
  expect(container.textContent).toContain('Browse models');
  expect(container.textContent).toContain('Server model inventory');
  const options = Array.from(container.querySelectorAll('option')).map((o)=>o.textContent);
  expect(options).toEqual(['Hugging Face']);
 });

 it('prevents delete when confirmation cancelled', async()=>{
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const client:any={
    listModels:vi.fn().mockResolvedValue({models:[{modelRecordId:'r1',displayName:'M',provider:'huggingface',source:'huggingface',lifecycleStatus:'registered',artifactForm:'full-model',createdAt:'2026-01-01'}]}),
    browseModels:vi.fn().mockResolvedValue({models:[]}),getModelDetails:vi.fn(),saveModelReference:vi.fn(),downloadModel:vi.fn(),deleteModelRecord:vi.fn()
  };
  container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container);
  await act(async()=>{root.render(<ModelManagementFeature client={client}/>);});
  const deleteButton = Array.from(container.querySelectorAll('button')).find((b)=>b.textContent?.includes('Delete record'));
  await act(async()=>{deleteButton?.dispatchEvent(new Event('click',{bubbles:true}));});
  expect(client.deleteModelRecord).not.toHaveBeenCalled();
 });
});
