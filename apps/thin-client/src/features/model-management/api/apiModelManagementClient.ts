import type { BrowseModelsRequest, BrowseModelsResult, DeleteModelRecordRequest, DeleteModelRecordResult, DownloadModelRequest, DownloadModelResult, GetModelDetailsRequest, GetModelDetailsResult, ListModelsRequest, ListModelsResult, SaveModelReferenceRequest, SaveModelReferenceResult, UpdateModelRecordRequest, UpdateModelRecordResult } from "../../../../../../modules/contracts/model";

import { logThinClientDiagnostic } from "../../../diagnostics/thinClientDiagnostics";

type ApiEnvelope = { ok: boolean; value?: unknown; error?: { message?: string; code?: string; details?: unknown } };
type Operation = "browse"|"details"|"list"|"save"|"download"|"update"|"delete";

export class ModelManagementApiError extends Error { constructor(message: string, public readonly code?: string, public readonly details?: unknown) { super(message); }}
export interface ModelManagementApiClient { browseModels:(input:BrowseModelsRequest)=>Promise<BrowseModelsResult>; getModelDetails:(input:GetModelDetailsRequest)=>Promise<GetModelDetailsResult>; listModels:(input?:ListModelsRequest)=>Promise<ListModelsResult>; saveModelReference:(input:SaveModelReferenceRequest)=>Promise<SaveModelReferenceResult>; downloadModel:(input:DownloadModelRequest)=>Promise<DownloadModelResult>; updateModelRecord:(input:UpdateModelRecordRequest)=>Promise<UpdateModelRecordResult>; deleteModelRecord:(input:DeleteModelRecordRequest)=>Promise<DeleteModelRecordResult>; }
const apiUrl = (b: string, s: string) => `${b.trim().replace(/\/+$/, "") || "/api"}${s}`;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const ensureEnvelope = (v: unknown): ApiEnvelope => { if (isObject(v) && "ok" in v) return v as ApiEnvelope; throw new ModelManagementApiError("Model management response is not a valid API envelope.", "invalid_envelope", v); };
const asError = (e: ApiEnvelope) => new ModelManagementApiError(e.error?.message ?? "Model management request failed.", e.error?.code, e.error?.details);
const requireObject = (value: unknown, message: string) => { if (!isObject(value)) throw new ModelManagementApiError(message, "invalid_payload", value); return value; };
const requireModels = (value: unknown, message: string) => { const obj = requireObject(value, message); if (!Array.isArray(obj.models)) throw new ModelManagementApiError(message, "invalid_payload", value); return obj; };
const timeouts:Record<Operation,number>={list:15000,details:15000,save:15000,delete:15000,update:15000,browse:30000,download:120000};
const summary=(b:Record<string,unknown>)=>({provider:b.provider,query:typeof b.query==="string"?b.query:undefined,modelId:typeof b.modelId==="string"?b.modelId:undefined,modelRecordId:typeof b.modelRecordId==="string"?b.modelRecordId:undefined,limit:typeof b.limit==="number"?b.limit:undefined});

const post = async <T>(base: string, path: string, operation:Operation, body: Record<string, unknown>, pick: (v: unknown) => T, headers?: Record<string, string>) => {
  const endpoint=apiUrl(base,path); const started=Date.now(); const ctrl=new AbortController(); const timeout=window.setTimeout(()=>ctrl.abort("timeout"),timeouts[operation]);
  const detail={operation,endpoint,...summary(body)}; logThinClientDiagnostic("info",{feature:"model-management",operation,phase:"request.start",message:"Request started",metadata:detail});
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const elapsedMs=Date.now()-started;
    const ctype=response.headers.get("content-type")??"";
    if(!ctype.includes("application/json")){ console.warn("[model-management.api] response.non_json",{...detail,status:response.status,elapsedMs,contentType:ctype}); throw new ModelManagementApiError("Model management response was not JSON.","invalid_json"); }
    let raw: unknown;
    try { raw = await response.json(); } catch { console.warn("[model-management.api] response.non_json",{...detail,status:response.status,elapsedMs}); throw new ModelManagementApiError("Model management response was not valid JSON.", "invalid_json"); }
    let envelope:ApiEnvelope;
    try { envelope = ensureEnvelope(raw); } catch (error) { console.warn("[model-management.api] response.malformed_envelope",{...detail,status:response.status,elapsedMs,message:error instanceof Error?error.message:String(error)}); throw error; }
    if (!envelope.ok) { const err=asError(envelope); console.warn("[model-management.api] request.failure",{...detail,status:response.status,elapsedMs,code:err.code,message:err.message}); throw err; }
    logThinClientDiagnostic("info",{feature:"model-management",operation,phase:"request.success",message:"Request success",metadata:{...detail,status:response.status,elapsedMs}});
    return pick(envelope.value);
  } catch (error) {
    const elapsedMs=Date.now()-started;
    if ((error instanceof DOMException && error.name === "AbortError") || error === "timeout") {
      logThinClientDiagnostic("warn",{feature:"model-management",operation,phase:"request.timeout",message:"Request timed out",metadata:{...detail,elapsedMs}}); throw new ModelManagementApiError(`Model management ${operation} request timed out.`,"timeout");
    }
    console.warn("[model-management.api] request.failure",{...detail,elapsedMs,message:error instanceof Error?error.message:String(error)}); throw error;
  } finally { window.clearTimeout(timeout); }
};

export function createApiModelManagementClient(options:{apiBaseUrl?:string;clientSource?:string}={}):ModelManagementApiClient { const apiBaseUrl=options.apiBaseUrl??"/api"; const clientSource=options.clientSource??"thin-client.model-management"; const requestHeaders={"x-client-source":clientSource}; return {
  browseModels: (input)=> post(apiBaseUrl,"/model/browse","browse",{...input,query:(input.query??"").trim(),limit:input.limit??20},(v)=>{ const obj = requireModels(v, "Browse models response is missing models array."); return { models: obj.models as BrowseModelsResult["models"], nextCursor: typeof obj.nextCursor === "string" ? obj.nextCursor : undefined }; }, requestHeaders),
  getModelDetails: (input)=> post(apiBaseUrl,"/model/details","details",{...input},(v)=>{const obj=requireObject(v,"Model details response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Model details response is missing model.","invalid_payload",v); return {model:obj.model as unknown as GetModelDetailsResult["model"]};}, requestHeaders),
  listModels: (input={})=> post(apiBaseUrl,"/model/list","list",{...input},(v)=>{ const obj = requireModels(v, "List models response is missing models array."); return { models: obj.models as ListModelsResult["models"], nextCursor: typeof obj.nextCursor === "string" ? obj.nextCursor : undefined }; }, requestHeaders),
  saveModelReference:(input)=> post(apiBaseUrl,"/model/reference/save","save",{...input},(v)=>{const obj=requireObject(v,"Save model response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Save model response is missing model.","invalid_payload",v); return {model:obj.model as unknown as SaveModelReferenceResult["model"]};}, requestHeaders),
  downloadModel:(input)=> post(apiBaseUrl,"/model/download","download",{...input},(v)=>{const obj=requireObject(v,"Download model response is malformed."); if(!isObject(obj.model)||!isObject(obj.download)) throw new ModelManagementApiError("Download model response is malformed.","invalid_payload",v); const d=obj.download; if(typeof d.modelId!=="string"||typeof d.downloaded!=="boolean"||typeof d.fromCache!=="boolean"||typeof d.localPath!=="string") throw new ModelManagementApiError("Download model response has invalid download fields.","invalid_payload",v); return { model: obj.model as unknown as DownloadModelResult["model"], download: d as unknown as DownloadModelResult["download"] };}, requestHeaders),
  updateModelRecord:(input)=> post(apiBaseUrl,"/model/record/update","update",{...input},(v)=>{const obj=requireObject(v,"Update model response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Update model response is missing model.","invalid_payload",v); return {model:obj.model as unknown as UpdateModelRecordResult["model"]};}, requestHeaders),
  deleteModelRecord:(input)=> post(apiBaseUrl,"/model/record/delete","delete",{...input},(v)=>{ const obj=requireObject(v,"Delete model response is malformed."); if(typeof obj.deletedModelRecordId!=="string"||typeof obj.deletedRegistryRecord!=="boolean"||typeof obj.deletedLocalFiles!=="boolean"||!Array.isArray(obj.deletedBackingArtifactIds)) throw new ModelManagementApiError("Delete model response is malformed.","invalid_payload",v); return obj as unknown as DeleteModelRecordResult; }, requestHeaders),
 };}
