export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
const err = (message: string, code = "internal"): Result<never> => ({ ok: false, error: { code, message } });
const unwrap = <T,>(r: unknown): Result<T> => { const v = r as any; return v?.ok ? { ok: true, value: v.value as T } : err(v?.error?.message ?? "Unable to complete request.", v?.error?.code ?? "internal"); };
export function createDesktopAssetCompositionClient(){
  const api=((globalThis as any).window?.desktopApi ?? {}) as Record<string, ((x:any)=>Promise<unknown>)|undefined>;
  return {
    createPlan: async (input:{targetWorkspaceId:string; name:string; description?:string}) => typeof api.createAssetCompositionPlan !== "function" ? err("Asset composition is unavailable.","unavailable") : unwrap(await api.createAssetCompositionPlan(input)),
    updatePlan: async (input:{targetWorkspaceId:string; planId:string; name?:string; description?:string; status?:string}) => typeof api.updateAssetCompositionPlan !== "function" ? err("Asset composition is unavailable.","unavailable") : unwrap(await api.updateAssetCompositionPlan(input)),
    readPlan: async (input:{targetWorkspaceId:string; planId:string}) => typeof api.readAssetCompositionPlan !== "function" ? err("Asset composition is unavailable.","unavailable") : unwrap(await api.readAssetCompositionPlan(input)),
    listPlans: async (input:{targetWorkspaceId:string; status?:string; text?:string; limit?:number; cursor?:string}) => typeof api.listAssetCompositionPlans !== "function" ? err("Asset composition is unavailable.","unavailable") : unwrap(await api.listAssetCompositionPlans(input)),
  };
}
