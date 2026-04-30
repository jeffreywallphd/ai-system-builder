import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createDesktopImageGenerationClient } from "../api";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export interface ImageGenerationFormValues {
  prompt: string;
  negativePrompt: string;
  seed: string;
  width: number;
  height: number;
  steps: number;
  sampler: string;
  scheduler: string;
  model: string;
  numImages: number;
}

export type ImageGenerationUiStatus = "idle" | "starting" | "queued" | "running" | "finalizing" | "succeeded" | "failed" | "cancelled" | "unknown";

export function useImageGenerationFeature(client = createDesktopImageGenerationClient()) {
  const [form, setForm] = useState<ImageGenerationFormValues>({ prompt: "", negativePrompt: "", seed: "", width: 1024, height: 1024, steps: 30, sampler: "", scheduler: "", model: "", numImages: 1 });
  const [status, setStatus] = useState<ImageGenerationUiStatus>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<{ message?: string; current?: number; total?: number } | undefined>(undefined);
  const [taskData, setTaskData] = useState<any>(undefined);
  const [finalized, setFinalized] = useState<any>(undefined);
  const mountedRef = useRef(true);
  const activePollRef = useRef<string | undefined>(undefined);

  useEffect(() => () => { mountedRef.current = false; activePollRef.current = undefined; }, []);

  const validationError = useMemo(() => {
    if (!form.prompt.trim()) return "Prompt is required.";
    if (form.width <= 0 || form.height <= 0 || form.steps <= 0 || form.numImages <= 0) return "Width, height, steps, and number of images must be positive.";
    return undefined;
  }, [form]);

  const poll = useCallback(async (id: string) => {
    if (activePollRef.current === id) return;
    activePollRef.current = id;
    while (mountedRef.current && activePollRef.current === id) {
      const read: any = await client.readImageGeneration({ requestId: id });
      if (!mountedRef.current || activePollRef.current !== id) return;
      if (!read?.ok) { setStatus("failed"); setError(read?.error?.message ?? "Failed to read image generation status."); return; }
      setTaskData(read.value);
      setProgress(read.value?.progress);
      const runtimeStatus = read.status ?? read.value?.status;
      if (runtimeStatus === "queued" || runtimeStatus === "pending") { setStatus("queued"); setMessage(read.value?.progress?.message); await sleep(600); continue; }
      if (runtimeStatus === "running") { setStatus("running"); setMessage(read.value?.progress?.message); await sleep(600); continue; }
      if (runtimeStatus === "succeeded") {
        setStatus("finalizing");
        const fin: any = await client.finalizeImageGenerationIfCompleted({ requestId: id });
        if (!mountedRef.current || activePollRef.current !== id) return;
        if (fin?.ok) setFinalized(fin.value);
        setStatus("succeeded");
        return;
      }
      if (runtimeStatus === "failed") { setStatus("failed"); setError(read.value?.error?.message ?? "Task failed."); return; }
      if (runtimeStatus === "cancelled") { setStatus("cancelled"); return; }
      setStatus("unknown");
      return;
    }
  }, [client]);

  const start = useCallback(async () => {
    if (validationError) return false;
    setStatus("starting"); setError(undefined); setMessage(undefined); setFinalized(undefined); setTaskData(undefined);
    const payload: Record<string, unknown> = { prompt: form.prompt, width: form.width, height: form.height, steps: form.steps, numImages: form.numImages };
    if (form.negativePrompt.trim()) payload.negativePrompt = form.negativePrompt.trim();
    if (form.seed.trim()) payload.seed = Number(form.seed);
    if (form.sampler.trim()) payload.sampler = form.sampler.trim();
    if (form.scheduler.trim()) payload.scheduler = form.scheduler.trim();
    if (form.model.trim()) payload.model = form.model.trim();
    const started: any = await client.startImageGeneration(payload);
    if (!started?.ok || !started?.value?.requestId) { setStatus("failed"); setError(started?.error?.message ?? "Failed to start image generation."); return false; }
    const id = started.value.requestId as string;
    setRequestId(id);
    setStatus("queued");
    void poll(id);
    return true;
  }, [client, form, poll, validationError]);

  const cancel = useCallback(async () => {
    if (!requestId) return;
    const cancelled: any = await client.cancelImageGeneration({ requestId });
    if (!mountedRef.current) return;
    if (cancelled?.ok && cancelled?.value?.cancelled === true) {
      setStatus("cancelled");
      setMessage(cancelled.value.message);
      activePollRef.current = undefined;
      return;
    }
    setMessage(cancelled?.value?.message ?? "Cancellation is not supported for this request.");
  }, [client, requestId]);

  return { form, setForm, status, message, error, requestId, progress, taskData, finalized, validationError, start, cancel };
}
