import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";
export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const err = (message: string, code = "internal"): Result<never> => ({ ok: false, error: { code, message } });
const unwrap = <T,>(r: unknown): Result<T> => { const v = r as any; return v?.ok ? { ok: true, value: v.value as T } : err(v?.error?.message ?? "Unable to complete request.", v?.error?.code ?? "internal"); };
const getJson = async (url:string)=> parseApiEnvelope(await (await secureFetch(url,{method:"GET"})).json());
const postJson = async (url:string, body:unknown)=> parseApiEnvelope(await (await secureFetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})).json());
const patchJson = async (url:string, body:unknown)=> parseApiEnvelope(await (await secureFetch(url,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)})).json());
export function createThinClientAssetCompositionClient(base="/api"){
  const b=base.replace(/\/+$/,'');
  return {
    createPlan: async (input:{targetWorkspaceId:string; name:string; description?:string})=>{ try{return unwrap(await postJson(`${b}/asset-composition/workspaces/${encodeURIComponent(input.targetWorkspaceId)}/plans`,input)); }catch{return err("Asset composition is unavailable.","unavailable");}},
    updatePlan: async (input:{targetWorkspaceId:string; planId:string; name?:string; description?:string; status?:string})=>{ try{return unwrap(await patchJson(`${b}/asset-composition/workspaces/${encodeURIComponent(input.targetWorkspaceId)}/plans/${encodeURIComponent(input.planId)}`,input)); }catch{return err("Asset composition is unavailable.","unavailable");}},
    readPlan: async (input:{targetWorkspaceId:string; planId:string})=>{ try{return unwrap(await getJson(`${b}/asset-composition/workspaces/${encodeURIComponent(input.targetWorkspaceId)}/plans/${encodeURIComponent(input.planId)}`)); }catch{return err("Asset composition is unavailable.","unavailable");}},
    listPlans: async (input:{targetWorkspaceId:string; status?:string; text?:string; limit?:number; cursor?:string})=>{ try{return unwrap(await getJson(`${b}/asset-composition/workspaces/${encodeURIComponent(input.targetWorkspaceId)}/plans`)); }catch{return err("Asset composition is unavailable.","unavailable");}},
  };
}
