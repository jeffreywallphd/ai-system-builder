import type { ModelManagementApiClient } from "../api/apiModelManagementClient";
import { useModelManagementFeature } from "../hooks/useModelManagementFeature";
export function ModelManagementFeature({client}:{client?:ModelManagementApiClient}){ const vm=useModelManagementFeature(client); return <section className="ui-panel ui-stack ui-stack--sm"><h2>Model Management</h2>
{vm.error?<p role="alert">{vm.error}</p>:null}{vm.status?<p role="status">{vm.status}</p>:null}
<section className="ui-stack ui-stack--sm"><h3>Browse models</h3><input className="ui-input" value={vm.query} placeholder="Search models" onChange={(e)=>vm.setQuery(e.target.value)}/>
<select className="ui-input" value={vm.provider} onChange={(e)=>vm.setProvider(e.target.value as "huggingface"|"unknown")}><option value="huggingface">Hugging Face</option><option value="unknown">Unknown</option></select>
<div className="ui-grid ui-grid--two"><button className="ui-button" onClick={()=>void vm.browse()} disabled={vm.loading}>Browse</button><button className="ui-button" onClick={vm.clear}>Clear</button></div></section>
<ul>{vm.browseResults.map((m)=><li key={m.modelId}><strong>{m.displayName}</strong> ({m.modelId}) <button className="ui-button" onClick={()=>void vm.viewDetails(m.modelId)}>Details</button> <button className="ui-button" onClick={()=>void vm.saveReference(m)}>Save Reference</button> <button className="ui-button" onClick={()=>void vm.download(m)}>Download</button></li>)}</ul>
<section className="ui-stack ui-stack--sm"><h3>Server model inventory</h3><button className="ui-button" onClick={()=>void vm.refreshInventory()}>Refresh</button>
<ul>{vm.inventory.map((m)=><li key={m.modelRecordId}><strong>{m.displayName}</strong> ({m.modelId??"n/a"}) - {m.lifecycleStatus} <button className="ui-button" onClick={()=>void vm.viewDetails(m.modelId??"")}>Details</button> <button className="ui-button" onClick={()=>void vm.deleteRecord(m.modelRecordId)}>Delete record</button></li>)}</ul></section>
{vm.details?<pre>{JSON.stringify(vm.details,null,2)}</pre>:null}</section>; }
