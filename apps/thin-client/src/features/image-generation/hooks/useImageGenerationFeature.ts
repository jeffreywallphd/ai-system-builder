import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageGenerationRequest } from "../../../../../../modules/contracts/image-generation";
import type { ModelInventoryRecord } from "../../../../../../modules/contracts/model";
import type { RuntimeTaskRecord, RuntimeTaskStatus } from "../../../../../../modules/contracts/runtime";
import {
  isImageGenerationModelCandidate,
  isImageGenerationModelReady,
  toImageGenerationModelDropdownOption,
} from "../../../../../../modules/ui/shared";
import { createApiModelManagementClient, type ModelManagementApiClient } from "../../model-management/api/apiModelManagementClient";
import { createApiImageGenerationClient, type FinalizedImageAsset, type ImageGenerationApiClient } from "../api/apiImageGenerationClient";

const POLL_INTERVAL_MS = 1200;
type UiStatus = "idle" | "starting" | "queued" | "running" | "succeeded" | "finalizing" | "finalized" | "failed" | "cancelled";
const ACTIVE_STATUSES: UiStatus[] = ["starting", "queued", "running", "finalizing"];

export interface ImageGenerationFormState { prompt: string; negativePrompt: string; seed: string; width: string; height: string; steps: string; sampler: string; scheduler: string; model: string; numImages: string }
const defaultImageGenerationClient = createApiImageGenerationClient();
const defaultModelManagementClient = createApiModelManagementClient();

export function isServerInventoryImageGenerationModel(model: ModelInventoryRecord): boolean {
  return isImageGenerationModelCandidate(model);
}

function rankInventoryModel(model: ModelInventoryRecord): number {
  let rank = 0;
  if (isImageGenerationModelReady(model)) rank -= 100;
  if (model.inferenceMode === "text-to-image") rank -= 20;
  if ((model.taskTags ?? []).some((tag) => tag === "text-to-image")) rank -= 10;
  if (model.artifactForm === "checkpoint") rank -= 10;
  return rank;
}

const toUiStatus = (status: RuntimeTaskStatus): UiStatus => (["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? status : "failed") as UiStatus;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const parsePositiveInt = (v: string) => { const n = Number(v); return Number.isInteger(n) && Number.isFinite(n) && n > 0 ? n : undefined; };
const parseSeed = (v: string) => { if (!v.trim()) return undefined; const n = Number(v); return Number.isInteger(n) && Number.isFinite(n) ? n : undefined; };

export function useImageGenerationFeature(
  client: ImageGenerationApiClient = defaultImageGenerationClient,
  onGenerated?: (assets: FinalizedImageAsset[]) => void,
  modelClient: ModelManagementApiClient = defaultModelManagementClient,
) {
  const [form, setForm] = useState<ImageGenerationFormState>({ prompt: "", negativePrompt: "", seed: "", width: "512", height: "512", steps: "20", sampler: "euler", scheduler: "normal", model: "", numImages: "1" });
  const [modelInventory, setModelInventory] = useState<ModelInventoryRecord[]>([]);
  const [modelInventoryLoading, setModelInventoryLoading] = useState(false);
  const [modelInventoryError, setModelInventoryError] = useState<string | undefined>(undefined);
  const [selectedModelRecordId, setSelectedModelRecordId] = useState<string>("");
  const [status, setStatus] = useState<UiStatus>("idle");
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<FinalizedImageAsset[]>([]);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  const mountedRef = useRef(true);
  const activeRequestRef = useRef<string | undefined>(undefined);
  const pollRunIdRef = useRef(0);
  const finalizedByRequestRef = useRef(new Set<string>());
  const modelInventoryRequestRef = useRef(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; pollRunIdRef.current += 1; activeRequestRef.current = undefined; }; }, []);

  const refreshModelInventory = useCallback(async () => {
    const requestId = ++modelInventoryRequestRef.current;
    setModelInventoryLoading(true);
    setModelInventoryError(undefined);
    console.info("[image-generation] inventory.list.start", { operation: "list", endpoint: "/api/model/list" });
    try {
      const result = await modelClient.listModels();
      if (!mountedRef.current || requestId !== modelInventoryRequestRef.current) return;
      const sorted = [...result.models].sort((a, b) => rankInventoryModel(a) - rankInventoryModel(b) || a.displayName.localeCompare(b.displayName));
      const downloadedImageModel = sorted.find((m) => isServerInventoryImageGenerationModel(m) && isImageGenerationModelReady(m));
      setModelInventory(sorted);
      console.info("[image-generation] inventory.list.success", { operation: "list", endpoint: "/api/model/list", totalModels: sorted.length, imageCandidates: sorted.filter(isServerInventoryImageGenerationModel).length, selectedModelRecordId: downloadedImageModel?.modelRecordId ?? "", manualFallback: !downloadedImageModel });
      setSelectedModelRecordId((current) => {
        if (current && sorted.some((m) => m.modelRecordId === current && isServerInventoryImageGenerationModel(m))) return current;
        if (downloadedImageModel) return downloadedImageModel.modelRecordId;
        return "";
      });
    } catch (e) {
      if (!mountedRef.current || requestId !== modelInventoryRequestRef.current) return;
      const message = e instanceof Error ? e.message : "Failed to load model inventory.";
      console.warn("[image-generation] inventory.list.failure", { operation: "list", endpoint: "/api/model/list", message, selectedModelRecordId });
      setModelInventoryError(message);
    } finally {
      if (mountedRef.current && requestId === modelInventoryRequestRef.current) setModelInventoryLoading(false);
    }
  }, [modelClient]);

  useEffect(() => { void refreshModelInventory(); }, [refreshModelInventory]);

  const validationError = useMemo(() => {
    if (!form.prompt.trim()) return "Prompt is required.";
    if (!parsePositiveInt(form.width) || !parsePositiveInt(form.height) || !parsePositiveInt(form.steps) || !parsePositiveInt(form.numImages)) return "Width, height, steps, and number of images must be positive integers.";
    if (form.seed.trim() && parseSeed(form.seed) === undefined) return "Seed must be a finite integer when provided.";
    return undefined;
  }, [form]);

  const selectedModelRecord = useMemo(() => modelInventory.find((m) => m.modelRecordId === selectedModelRecordId), [modelInventory, selectedModelRecordId]);

  const pollUntilTerminal = useCallback(async (id: string, runId: number): Promise<RuntimeTaskRecord | undefined> => {
    let latest = await client.readImageGeneration({ requestId: id });
    while (mountedRef.current && pollRunIdRef.current === runId) {
      setStatus(toUiStatus(latest.status));
      if (["succeeded", "failed", "cancelled"].includes(latest.status)) return latest;
      await sleep(POLL_INTERVAL_MS);
      if (!mountedRef.current || pollRunIdRef.current !== runId) return undefined;
      latest = await client.readImageGeneration({ requestId: id });
    }
    return undefined;
  }, [client]);

  const start = useCallback(async () => {
    setHasAttemptedGeneration(true);
    if (ACTIVE_STATUSES.includes(status)) return;
    if (validationError) { setError(validationError); return; }
    if (selectedModelRecord) {
      if (!isServerInventoryImageGenerationModel(selectedModelRecord)) {
        setError("Selected server model is not an image generation model. Choose a downloaded image model or use the manual checkpoint override.");
        return;
      }
      if (!isImageGenerationModelReady(selectedModelRecord)) {
        setError("Selected server model is a saved reference only. Download the image model before generating.");
        return;
      }
    }

    pollRunIdRef.current += 1;
    const runId = pollRunIdRef.current;
    activeRequestRef.current = undefined;

    try {
      setError(undefined); setResults([]); setRequestId(undefined); setStatus("starting");
      const payload: ImageGenerationRequest = {
        prompt: form.prompt.trim(), width: parsePositiveInt(form.width)!, height: parsePositiveInt(form.height)!, steps: parsePositiveInt(form.steps)!, numImages: parsePositiveInt(form.numImages)!,
        sampler: form.sampler.trim() || "euler", scheduler: form.scheduler.trim() || "normal",
      };
      const seed = parseSeed(form.seed); if (seed !== undefined) payload.seed = seed;
      if (selectedModelRecordId.trim()) payload.model = selectedModelRecordId.trim();
      else if (form.model.trim()) payload.model = form.model.trim();
      if (form.negativePrompt.trim()) payload.negativePrompt = form.negativePrompt.trim();

      const started = await client.startImageGeneration(payload);
      if (!mountedRef.current || pollRunIdRef.current !== runId) return;
      setRequestId(started.requestId); activeRequestRef.current = started.requestId; setStatus("queued");

      const finalTask = await pollUntilTerminal(started.requestId, runId);
      if (!finalTask || !mountedRef.current || pollRunIdRef.current !== runId) return;
      if (finalTask.status !== "succeeded") return;

      if (finalizedByRequestRef.current.has(started.requestId)) { setStatus("finalized"); return; }
      setStatus("finalizing");
      const finalized = await client.finalizeImageGenerationIfCompleted({ requestId: started.requestId });
      if (!mountedRef.current || pollRunIdRef.current !== runId) return;

      if (finalized.finalized) {
        finalizedByRequestRef.current.add(started.requestId);
        const assets = finalized.assets ?? [];
        setResults(assets);
        setStatus("finalized");
        onGenerated?.(assets);
      } else {
        setStatus("failed");
        setError(finalized.reason ?? "Finalization did not complete.");
      }
    } catch (cause) {
      if (!mountedRef.current || pollRunIdRef.current !== runId) return;
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "Image generation failed.");
    }
  }, [client, form, onGenerated, pollUntilTerminal, selectedModelRecord, selectedModelRecordId, status, validationError]);

  const cancel = useCallback(async () => {
    pollRunIdRef.current += 1;
    const id = activeRequestRef.current ?? requestId;
    activeRequestRef.current = undefined;
    setStatus("cancelled");
    if (!id) return;
    try { await client.cancelImageGeneration({ requestId: id }); } catch { }
  }, [client, requestId]);

  useEffect(() => {
    if (!hasAttemptedGeneration) return;
    setError(validationError);
  }, [form, hasAttemptedGeneration, validationError]);

  const qualityNote = useMemo(() => {
    const width = Number(form.width); const height = Number(form.height); const steps = Number(form.steps);
    if (width <= 256 || height <= 256 || steps < 15) return "Quality warning: very small resolution or low steps can reduce detail; SDXL-style models generally perform better with larger sizes and 15+ steps.";
    return undefined;
  }, [form.width, form.height, form.steps]);

  const imageGenerationModels = useMemo(() => modelInventory.filter(isServerInventoryImageGenerationModel), [modelInventory]);
  const downloadedImageGenerationModels = useMemo(() => imageGenerationModels.filter(isImageGenerationModelReady), [imageGenerationModels]);
  const referenceOnlyImageGenerationModels = useMemo(() => imageGenerationModels.filter((m) => !isImageGenerationModelReady(m)), [imageGenerationModels]);
  const imageGenerationModelOptions = useMemo(() => imageGenerationModels.map(toImageGenerationModelDropdownOption).filter((option): option is NonNullable<typeof option> => Boolean(option)), [imageGenerationModels]);

  return { form, setForm, status, error, requestId, results, start, cancel, qualityNote, validationError: hasAttemptedGeneration ? validationError : undefined, isGenerateDisabled: ACTIVE_STATUSES.includes(status), isCancelDisabled: !(requestId && ["queued", "running", "starting", "finalizing"].includes(status)), createPreviewUrl: client.createArtifactMediaViewUrl, modelInventory, modelInventoryLoading, modelInventoryError, refreshModelInventory, selectedModelRecordId, setSelectedModelRecordId, selectedModelRecord, imageGenerationModels, downloadedImageGenerationModels, referenceOnlyImageGenerationModels, imageGenerationModelOptions };
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
