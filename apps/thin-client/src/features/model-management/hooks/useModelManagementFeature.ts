import { useEffect, useState } from "react";
import type { ModelBrowseItem, ModelInventoryRecord } from "../../../../../../modules/contracts/model";
import { createApiModelManagementClient, type ModelManagementApiClient } from "../api/apiModelManagementClient";

export function useModelManagementFeature(client: ModelManagementApiClient = createApiModelManagementClient()) {
const [query,setQuery]=useState(""); const [provider,setProvider]=useState<"huggingface"|"unknown">("huggingface");
const [browseResults,setBrowseResults]=useState<ModelBrowseItem[]>([]); const [inventory,setInventory]=useState<ModelInventoryRecord[]>([]);
const [details,setDetails]=useState<Record<string, unknown>|undefined>(); const [status,setStatus]=useState<string>(""); const [error,setError]=useState<string>(""); const [loading,setLoading]=useState(false);
const refreshInventory=async()=>{ const result=await client.listModels({provider}); setInventory(result.models); };
useEffect(()=>{ void refreshInventory(); },[]);
const browse=async()=>{ setLoading(true); setError(""); try{ const res=await client.browseModels({provider,query}); setBrowseResults(res.models); setStatus(`Loaded ${res.models.length} models.`);}catch(e){setError(e instanceof Error?e.message:"Browse failed.");} finally{setLoading(false);} };
const clear=()=>{setQuery("");setBrowseResults([]);setStatus("");setError("");};
const viewDetails=async(modelId:string)=>{ try{ const res=await client.getModelDetails({provider,modelId}); setDetails(res.model as unknown as Record<string,unknown>);}catch(e){setError(e instanceof Error?e.message:"Details failed.");} };
const saveReference=async(item:ModelBrowseItem)=>{ try{ await client.saveModelReference({provider:item.provider,modelId:item.modelId,displayName:item.displayName,taskTags:item.taskTags,inferenceMode:item.inferenceMode}); setStatus(`Saved ${item.displayName}.`); await refreshInventory();}catch(e){setError(e instanceof Error?e.message:"Save failed.");} };
const download=async(item:ModelBrowseItem)=>{ try{ const result=await client.downloadModel({provider:item.provider,modelId:item.modelId,displayName:item.displayName,taskTags:item.taskTags,inferenceMode:item.inferenceMode}); setStatus(`${item.displayName} downloaded: ${result.download.downloaded?"yes":"no"}.`); await refreshInventory();}catch(e){setError(e instanceof Error?e.message:"Download failed.");} };
const deleteRecord=async(modelRecordId:string)=>{ if(!window.confirm("Delete this model record?")) return; try{ await client.deleteModelRecord({modelRecordId,deleteLocalFiles:false}); await refreshInventory(); setStatus("Model record deleted."); }catch(e){setError(e instanceof Error?e.message:"Delete failed.");} };
return {query,setQuery,provider,setProvider,browseResults,inventory,details,status,error,loading,browse,clear,refreshInventory,viewDetails,saveReference,download,deleteRecord};
}
