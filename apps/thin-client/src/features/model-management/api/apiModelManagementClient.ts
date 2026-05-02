import type { BrowseModelsRequest, BrowseModelsResult, DeleteModelRecordRequest, DeleteModelRecordResult, DownloadModelRequest, DownloadModelResult, GetModelDetailsRequest, GetModelDetailsResult, ListModelsRequest, ListModelsResult, SaveModelReferenceRequest, SaveModelReferenceResult, UpdateModelRecordRequest, UpdateModelRecordResult } from "../../../../../../modules/contracts/model";

type ApiEnvelope = { ok: boolean; value?: unknown; error?: { message?: string; code?: string; details?: unknown } };

export class ModelManagementApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly details?: unknown) {
    super(message);
  }
}

export interface ModelManagementApiClient { browseModels:(input:BrowseModelsRequest)=>Promise<BrowseModelsResult>; getModelDetails:(input:GetModelDetailsRequest)=>Promise<GetModelDetailsResult>; listModels:(input?:ListModelsRequest)=>Promise<ListModelsResult>; saveModelReference:(input:SaveModelReferenceRequest)=>Promise<SaveModelReferenceResult>; downloadModel:(input:DownloadModelRequest)=>Promise<DownloadModelResult>; updateModelRecord:(input:UpdateModelRecordRequest)=>Promise<UpdateModelRecordResult>; deleteModelRecord:(input:DeleteModelRecordRequest)=>Promise<DeleteModelRecordResult>; }

const apiUrl = (b: string, s: string) => `${b.trim().replace(/\/+$/, "") || "/api"}${s}`;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const ensureEnvelope = (v: unknown): ApiEnvelope => { if (isObject(v) && "ok" in v) return v as ApiEnvelope; throw new ModelManagementApiError("Model management response is not a valid API envelope.", "invalid_envelope", v); };
const asError = (e: ApiEnvelope) => new ModelManagementApiError(e.error?.message ?? "Model management request failed.", e.error?.code, e.error?.details);
const requireObject = (value: unknown, message: string) => { if (!isObject(value)) throw new ModelManagementApiError(message, "invalid_payload", value); return value; };
const requireModels = (value: unknown, message: string) => { const obj = requireObject(value, message); if (!Array.isArray(obj.models)) throw new ModelManagementApiError(message, "invalid_payload", value); return obj; };

const post = async <T>(base: string, path: string, body: Record<string, unknown>, pick: (v: unknown) => T) => {
  const response = await fetch(apiUrl(base, path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new ModelManagementApiError("Model management response was not valid JSON.", "invalid_json"); }
  const envelope = ensureEnvelope(raw);
  if (!envelope.ok) throw asError(envelope);
  return pick(envelope.value);
};

export function createApiModelManagementClient(options:{apiBaseUrl?:string;source?:string}={}):ModelManagementApiClient { const apiBaseUrl=options.apiBaseUrl??"/api"; const source=options.source??"thin-client.model-management"; return {
  browseModels: (input)=> post(apiBaseUrl,"/model/browse",{...input,source},(v)=>{ const obj = requireModels(v, "Browse models response is missing models array."); return { models: obj.models as BrowseModelsResult["models"], nextCursor: typeof obj.nextCursor === "string" ? obj.nextCursor : undefined }; }),
  getModelDetails: (input)=> post(apiBaseUrl,"/model/details",{...input,source},(v)=>{const obj=requireObject(v,"Model details response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Model details response is missing model.","invalid_payload",v); return {model:obj.model as unknown as GetModelDetailsResult["model"]};}),
  listModels: (input={})=> post(apiBaseUrl,"/model/list",{...input,source},(v)=>{ const obj = requireModels(v, "List models response is missing models array."); return { models: obj.models as ListModelsResult["models"], nextCursor: typeof obj.nextCursor === "string" ? obj.nextCursor : undefined }; }),
  saveModelReference:(input)=> post(apiBaseUrl,"/model/reference/save",{...input,source},(v)=>{const obj=requireObject(v,"Save model response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Save model response is missing model.","invalid_payload",v); return {model:obj.model as unknown as SaveModelReferenceResult["model"]};}),
  downloadModel:(input)=> post(apiBaseUrl,"/model/download",{...input,source},(v)=>{const obj=requireObject(v,"Download model response is malformed."); if(!isObject(obj.model)||!isObject(obj.download)) throw new ModelManagementApiError("Download model response is malformed.","invalid_payload",v); const d=obj.download; if(typeof d.modelId!=="string"||typeof d.downloaded!=="boolean"||typeof d.fromCache!=="boolean"||typeof d.localPath!=="string") throw new ModelManagementApiError("Download model response has invalid download fields.","invalid_payload",v); return { model: obj.model as unknown as DownloadModelResult["model"], download: d as unknown as DownloadModelResult["download"] };}),
  updateModelRecord:(input)=> post(apiBaseUrl,"/model/record/update",{...input,source},(v)=>{const obj=requireObject(v,"Update model response is missing model."); if(!isObject(obj.model)) throw new ModelManagementApiError("Update model response is missing model.","invalid_payload",v); return {model:obj.model as unknown as UpdateModelRecordResult["model"]};}),
  deleteModelRecord:(input)=> post(apiBaseUrl,"/model/record/delete",{...input,source},(v)=>{ const obj=requireObject(v,"Delete model response is malformed."); if(typeof obj.deletedModelRecordId!=="string"||typeof obj.deletedRegistryRecord!=="boolean"||typeof obj.deletedLocalFiles!=="boolean"||!Array.isArray(obj.deletedBackingArtifactIds)) throw new ModelManagementApiError("Delete model response is malformed.","invalid_payload",v); return obj as unknown as DeleteModelRecordResult; }),
 };}
