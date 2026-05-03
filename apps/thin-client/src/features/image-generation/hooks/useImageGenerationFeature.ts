import { useCallback, useState } from "react";
import { createApiImageGenerationClient, type ImageGenerationApiError } from "../api/apiImageGenerationClient";
import { createApiArtifactBrowserClient } from "../../artifact-browser/api/apiArtifactBrowserClient";
import { logImageGenerationDiagnostic } from "../../diagnostics/imageGenerationDiagnostics";

const runtimeGuidance = (error: ImageGenerationApiError) => {
  const t = `${error.code} ${error.message}`.toLowerCase();
  if (t.includes("unmanaged-install-root") || t.includes("non-empty and unmanaged")) return "ComfyUI could not start because the server runtime install folder is non-empty but not managed by AI System Builder. Set SERVER_RUNTIME_ROOT to a clean runtime folder, set COMFYUI_INSTALL_ROOT to a managed ComfyUI checkout, or move/delete the unmanaged folder if it is a failed partial install. Destructive repair is intentionally not automatic.";
  if (t.includes("python-environment-create-failed") || t.includes("python-dependency-install-failed")) return "ComfyUI Python environment setup failed on the server. Verify Python availability and retry runtime repair/install.";
  if (t.includes("installroot is required") || t.includes("missing install root")) return "ComfyUI install root is missing on the server. Configure SERVER_RUNTIME_ROOT or COMFYUI_INSTALL_ROOT.";
  if (t.includes("validation") || t.includes("startup") || t.includes("timeout") || t.includes("unhealthy")) return "ComfyUI runtime startup failed or timed out. Verify runtime health and Python setup, then retry.";
  return undefined;
};
export function useImageGenerationFeature() {
  const client = createApiImageGenerationClient();
  const artifacts = createApiArtifactBrowserClient();
  const [status,setStatus]=useState("idle"); const [error,setError]=useState<ImageGenerationApiError|undefined>(); const [friendlyError,setFriendlyError]=useState<string|undefined>(); const [images,setImages]=useState<string[]>([]);
  const start = useCallback(async (prompt:string)=>{ setStatus("starting"); setError(undefined); setFriendlyError(undefined); logImageGenerationDiagnostic("start.request",{hasPrompt:Boolean(prompt)}); const startR=await client.startImageGeneration({prompt}); if(!startR.ok){setStatus("failed"); setError(startR.error); setFriendlyError(runtimeGuidance(startR.error) ?? startR.error.message); logImageGenerationDiagnostic("start.failure",{code:startR.error.code,status:startR.error.httpStatus}); return;} logImageGenerationDiagnostic("start.success",{requestId:startR.value.requestId}); let done=false; while(!done){ logImageGenerationDiagnostic("read.request",{requestId:startR.value.requestId}); const read=await client.readImageGeneration(startR.value.requestId); if(!read.ok){setStatus("failed"); setError(read.error); setFriendlyError(runtimeGuidance(read.error) ?? read.error.message); logImageGenerationDiagnostic("read.failure",{code:read.error.code,status:read.error.httpStatus}); return;} const s=read.value.status; logImageGenerationDiagnostic("status.update",{status:s}); if(s==="queued"||s==="running"){setStatus(s); await new Promise(r=>setTimeout(r,300)); continue;} if(s==="failed"||s==="cancelled"){setStatus(s); done=true; break;} if(s==="succeeded"){ setStatus("finalizing"); logImageGenerationDiagnostic("finalize.request",{requestId:startR.value.requestId}); const fin=await client.finalizeImageGeneration(startR.value.requestId); if(!fin.ok){setStatus("failed"); setError(fin.error); setFriendlyError(runtimeGuidance(fin.error) ?? fin.error.message); logImageGenerationDiagnostic("finalize.failure",{code:fin.error.code,status:fin.error.httpStatus}); return;} const urls=(fin.value.assets??[]).map((a)=>artifacts.createArtifactMediaViewUrl({storageKey:a.storageKey ?? a.artifactId})); logImageGenerationDiagnostic("finalize.success",{assetCount:urls.length}); setImages(urls); setStatus("finalized"); done=true; } }
  },[client,artifacts]);
  return {status,error,friendlyError,images,start};
}
