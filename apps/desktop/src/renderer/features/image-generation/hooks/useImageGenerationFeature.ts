import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RuntimeTaskRecord } from "../../../../../../../modules/contracts/runtime";
import { createDesktopImageGenerationClient } from "../api";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export interface ImageGenerationOutputReference { fileName?: string; subfolder?: string; engine?: string; promptId?: string; }
export interface ImageGenerationFinalizedAssetReference { assetId: string; artifactId: string; }
export interface ImageGenerationTaskDataView { status?: string; progress?: { message?: string; current?: number; total?: number }; outputs: ImageGenerationOutputReference[]; }

export interface ImageGenerationFormValues {
  prompt: string; negativePrompt: string; seed: string; width: string; height: string; steps: string; sampler: string; scheduler: string; model: string; numImages: string;
}
export type ImageGenerationUiStatus = "idle" | "starting" | "queued" | "running" | "finalizing" | "succeeded" | "failed" | "cancelled" | "unknown";

const ACTIVE_STATUSES: ImageGenerationUiStatus[] = ["starting", "queued", "running", "finalizing"];

const parsePositiveNumber = (value: string) => {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const parseSeed = (seed: string): number | undefined => {
  if (seed.trim() === "") return undefined;
  const parsed = Number(seed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return undefined;
  return parsed;
};

export function normalizeImageGenerationOutputs(task: RuntimeTaskRecord): ImageGenerationOutputReference[] {
  const data = task.data as { outputs?: unknown; value?: { outputs?: unknown } } | undefined;
  const rawOutputs = Array.isArray(data?.outputs) ? data.outputs : Array.isArray(data?.value?.outputs) ? data.value.outputs : [];
  return rawOutputs
    .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
    .map((o) => ({ fileName: typeof o.fileName === "string" ? o.fileName : undefined, subfolder: typeof o.subfolder === "string" ? o.subfolder : undefined, engine: typeof o.engine === "string" ? o.engine : undefined, promptId: typeof o.promptId === "string" ? o.promptId : undefined }));
}

export function useImageGenerationFeature(client = createDesktopImageGenerationClient()) {
  const [form, setForm] = useState<ImageGenerationFormValues>({ prompt: "", negativePrompt: "", seed: "", width: "1024", height: "1024", steps: "30", sampler: "", scheduler: "", model: "", numImages: "1" });
  const [status, setStatus] = useState<ImageGenerationUiStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [progress, setProgress] = useState<{ message?: string; current?: number; total?: number }>();
  const [taskData, setTaskData] = useState<ImageGenerationTaskDataView>();
  const [outputs, setOutputs] = useState<ImageGenerationOutputReference[]>([]);
  const [finalizedAssets, setFinalizedAssets] = useState<ImageGenerationFinalizedAssetReference[]>([]);
  const [installStatus, setInstallStatus] = useState<string>("checking");
  const mountedRef = useRef(true);
  const activePollRef = useRef<string>();

  const isPollingStillActive = useCallback((id: string) => mountedRef.current && activePollRef.current === id, []);
  useEffect(() => () => { mountedRef.current = false; activePollRef.current = undefined; }, []);
  useEffect(() => {
    void (async () => {
      const status = await client.readComfyUiInstallStatus?.({});
      if (!status || !status.ok) { setInstallStatus("unknown"); return; }
      const raw = (status.value as { status?: string }).status;
      setInstallStatus(typeof raw === "string" ? raw : "unknown");
    })();
  }, [client]);

  const validationError = useMemo(() => {
    if (!form.prompt.trim()) return "Prompt is required.";
    if (!parsePositiveNumber(form.width) || !parsePositiveNumber(form.height) || !parsePositiveNumber(form.steps) || !parsePositiveNumber(form.numImages)) return "Width, height, steps, and number of images must be positive finite numbers.";
    if (form.seed.trim() && parseSeed(form.seed) === undefined) return "Seed must be a finite integer when provided.";
    return undefined;
  }, [form]);

  const isStartDisabled = ACTIVE_STATUSES.includes(status);

  const poll = useCallback(async (id: string) => {
    if (activePollRef.current === id) return;
    activePollRef.current = id;
    while (isPollingStillActive(id)) {
      const read = await client.readImageGeneration({ requestId: id });
      if (!isPollingStillActive(id)) return;
      if (!read.ok) { setStatus("failed"); setError(read.error.message ?? "Failed to read image generation status."); return; }
      const view: ImageGenerationTaskDataView = { status: read.value.status, progress: read.value.progress ? { message: read.value.progress.message, current: read.value.progress.current, total: read.value.progress.total } : undefined, outputs: normalizeImageGenerationOutputs(read.value) };
      setTaskData(view); setProgress(view.progress); setOutputs(view.outputs);
      const runtimeStatus = read.value.status;
      if (runtimeStatus === "queued" || runtimeStatus === "pending") { setStatus("queued"); setMessage(view.progress?.message); await sleep(600); if (!isPollingStillActive(id)) return; continue; }
      if (runtimeStatus === "running") { setStatus("running"); setMessage(view.progress?.message); await sleep(600); if (!isPollingStillActive(id)) return; continue; }
      if (runtimeStatus === "succeeded") {
        setStatus("finalizing");
        const fin = await client.finalizeImageGenerationIfCompleted({ requestId: id });
        if (!isPollingStillActive(id)) return;
        if (fin.ok && Array.isArray(fin.value.assets)) {
          setFinalizedAssets(fin.value.assets.filter((a): a is ImageGenerationFinalizedAssetReference => typeof a?.assetId === "string" && typeof a?.artifactId === "string"));
        }
        setStatus("succeeded");
        return;
      }
      if (runtimeStatus === "failed") { setStatus("failed"); setError(read.value.error?.message ?? "Task failed."); return; }
      if (runtimeStatus === "cancelled") { setStatus("cancelled"); return; }
      setStatus("unknown"); return;
    }
  }, [client, isPollingStillActive]);

  const start = useCallback(async () => {
    if (validationError || isStartDisabled) return false;
    setStatus("starting"); setError(undefined); setMessage(undefined); setFinalizedAssets([]); setTaskData(undefined); setOutputs([]);
    const payload: Record<string, unknown> = { prompt: form.prompt, width: parsePositiveNumber(form.width), height: parsePositiveNumber(form.height), steps: parsePositiveNumber(form.steps), numImages: parsePositiveNumber(form.numImages) };
    if (form.negativePrompt.trim()) payload.negativePrompt = form.negativePrompt.trim();
    const seed = parseSeed(form.seed);
    if (seed !== undefined) payload.seed = seed;
    if (form.sampler.trim()) payload.sampler = form.sampler.trim();
    if (form.scheduler.trim()) payload.scheduler = form.scheduler.trim();
    if (form.model.trim()) payload.model = form.model.trim();
    const started = await client.startImageGeneration(payload);
    if (!started.ok || !started.value.requestId) { setStatus("failed"); setError(started.ok ? "Failed to start image generation." : started.error.message); return false; }
    const id = started.value.requestId;
    setRequestId(id); setStatus("queued");
    void poll(id);
    return true;
  }, [client, form, isStartDisabled, poll, validationError]);

  const cancel = useCallback(async () => {
    if (!requestId) return;
    const cancelled = await client.cancelImageGeneration({ requestId });
    if (!isPollingStillActive(requestId)) return;
    if (cancelled.ok && cancelled.value.cancelled === true) { setStatus("cancelled"); setMessage(cancelled.value.message); activePollRef.current = undefined; return; }
    setMessage(cancelled.ok ? (cancelled.value.message ?? "Cancellation is not supported for this request.") : cancelled.error.message);
  }, [client, isPollingStillActive, requestId]);

  const repairInstall = async () => { const result = await client.repairComfyUiInstall?.({ allowUpdate: true, forceRepair: true }); if (!result || !result.ok) { setError(result?.error?.message ?? "Failed to repair ComfyUI install."); return; } setInstallStatus("installing"); };
  return { form, setForm, status, message, error, requestId, progress, taskData, outputs, finalizedAssets, installStatus, validationError, isStartDisabled, start, cancel, repairInstall };
}
