import { useCallback, useState } from "react";
import { createApiImageGenerationClient, type ImageGenerationApiError } from "../api/apiImageGenerationClient";
import { createApiArtifactBrowserClient } from "../../artifact-browser/api/apiArtifactBrowserClient";

const runtimeGuidance = (error: ImageGenerationApiError) => {
  const t = `${error.code} ${error.message}`.toLowerCase();
  if (t.includes("unmanaged-install-root") || t.includes("non-empty and unmanaged")) return "ComfyUI could not start because the server runtime install folder is non-empty but unmanaged. Set SERVER_RUNTIME_ROOT to a clean folder, set COMFYUI_INSTALL_ROOT to a managed checkout, or move/delete the unmanaged partial install.";
  if (t.includes("python-environment-create-failed") || t.includes("python-dependency-install-failed")) return "ComfyUI Python environment setup failed on the server. Verify Python availability and retry runtime repair/install.";
  return undefined;
};
export function useImageGenerationFeature() {
  const client = createApiImageGenerationClient();
  const artifacts = createApiArtifactBrowserClient();
  const [status,setStatus]=useState("idle"); const [error,setError]=useState<ImageGenerationApiError|undefined>(); const [friendlyError,setFriendlyError]=useState<string|undefined>(); const [images,setImages]=useState<string[]>([]);
  const start = useCallback(async (prompt:string)=>{ setStatus("starting"); setError(undefined); setFriendlyError(undefined); const startR=await client.startImageGeneration({prompt}); if(!startR.ok){setStatus("failed"); setError(startR.error); setFriendlyError(runtimeGuidance(startR.error) ?? startR.error.message); return;} let done=false; while(!done){ const read=await client.readImageGeneration(startR.value.requestId); if(!read.ok){setStatus("failed"); setError(read.error); setFriendlyError(runtimeGuidance(read.error) ?? read.error.message); return;} const s=read.value.status; if(s==="queued"||s==="running"){setStatus(s); await new Promise(r=>setTimeout(r,300)); continue;} if(s==="failed"||s==="cancelled"){setStatus(s); done=true; break;} if(s==="succeeded"){ setStatus("finalizing"); const fin=await client.finalizeImageGenerationIfCompleted(startR.value.requestId); if(!fin.ok){setStatus("failed"); setError(fin.error); setFriendlyError(runtimeGuidance(fin.error) ?? fin.error.message); return;} const urls=(fin.value.assets??[]).map((a)=>artifacts.createArtifactMediaViewUrl({storageKey:a.storageKey ?? a.artifactId})); setImages(urls); setStatus("finalized"); done=true; } }
  },[client,artifacts]);
  return {status,error,friendlyError,images,start};
}
