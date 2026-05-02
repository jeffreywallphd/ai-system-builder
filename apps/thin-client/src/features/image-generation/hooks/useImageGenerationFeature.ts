import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageGenerationRequest } from "../../../../../../modules/contracts/image-generation";
import type { ModelInventoryRecord } from "../../../../../../modules/contracts/model";
import type { RuntimeTaskRecord, RuntimeTaskStatus } from "../../../../../../modules/contracts/runtime";
import { createApiModelManagementClient, type ModelManagementApiClient } from "../../model-management/api/apiModelManagementClient";
import { createApiImageGenerationClient, type FinalizedImageAsset, type ImageGenerationApiClient } from "../api/apiImageGenerationClient";

const POLL_INTERVAL_MS = 1200;
type UiStatus = "idle" | "starting" | "queued" | "running" | "succeeded" | "finalizing" | "finalized" | "failed" | "cancelled";
const ACTIVE_STATUSES: UiStatus[] = ["starting", "queued", "running", "finalizing"];

export interface ImageGenerationFormState { prompt: string; negativePrompt: string; seed: string; width: string; height: string; steps: string; sampler: string; scheduler: string; model: string; numImages: string }
const DOWNLOADED_STATUSES = new Set(["downloaded", "generated"]);
const IMAGE_TAGS = new Set(["image-generation", "text-to-image"]);
const IMAGE_ARTIFACTS = new Set(["checkpoint", "full-model"]);

function isLikelyImageModel(model: ModelInventoryRecord): boolean {
  return model.inferenceMode === "text-to-image" || (model.taskTags ?? []).some((tag) => IMAGE_TAGS.has(tag)) || IMAGE_ARTIFACTS.has(model.artifactForm);
}

function rankInventoryModel(model: ModelInventoryRecord): number {
  let rank = 0;
  if (DOWNLOADED_STATUSES.has(model.lifecycleStatus)) rank -= 100;
  if (model.inferenceMode === "text-to-image") rank -= 20;
  if ((model.taskTags ?? []).some((tag) => IMAGE_TAGS.has(tag))) rank -= 10;
  if (IMAGE_ARTIFACTS.has(model.artifactForm)) rank -= 10;
  return rank;
}

const toUiStatus = (status: RuntimeTaskStatus): UiStatus => (["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? status : "failed") as UiStatus;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const parsePositiveInt = (v: string) => { const n = Number(v); return Number.isInteger(n) && Number.isFinite(n) && n > 0 ? n : undefined; };
const parseSeed = (v: string) => { if (!v.trim()) return undefined; const n = Number(v); return Number.isInteger(n) && Number.isFinite(n) ? n : undefined; };

export function useImageGenerationFeature(
  client: ImageGenerationApiClient = createApiImageGenerationClient(),
  onGenerated?: (assets: FinalizedImageAsset[]) => void,
  modelClient: ModelManagementApiClient = createApiModelManagementClient(),
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

  useEffect(() => () => { mountedRef.current = false; pollRunIdRef.current += 1; activeRequestRef.current = undefined; }, []);

  const refreshModelInventory = useCallback(async () => {
    const requestId = ++modelInventoryRequestRef.current;
    setModelInventoryLoading(true);
    setModelInventoryError(undefined);
    try {
      const result = await modelClient.listModels();
      if (!mountedRef.current || requestId !== modelInventoryRequestRef.current) return;
      const sorted = [...result.models].sort((a, b) => rankInventoryModel(a) - rankInventoryModel(b) || a.displayName.localeCompare(b.displayName));
      const downloadedImageModel = sorted.find((m) => isLikelyImageModel(m) && DOWNLOADED_STATUSES.has(m.lifecycleStatus));
      const referenceImageModel = sorted.find((m) => isLikelyImageModel(m));
      setModelInventory(sorted);
      setSelectedModelRecordId((current) => {
        if (current && sorted.some((m) => m.modelRecordId === current)) return current;
        if (downloadedImageModel) return downloadedImageModel.modelRecordId;
        if (referenceImageModel) return referenceImageModel.modelRecordId;
        return "";
      });
    } catch (e) {
      if (!mountedRef.current || requestId !== modelInventoryRequestRef.current) return;
      setModelInventoryError(e instanceof Error ? e.message : "Failed to load model inventory.");
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
  }, [client, form, onGenerated, pollUntilTerminal, selectedModelRecordId, status, validationError]);

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

  const imageGenerationModels = useMemo(() => modelInventory.filter(isLikelyImageModel), [modelInventory]);
  const downloadedImageGenerationModels = useMemo(() => imageGenerationModels.filter((m) => DOWNLOADED_STATUSES.has(m.lifecycleStatus)), [imageGenerationModels]);
  const referenceOnlyImageGenerationModels = useMemo(() => imageGenerationModels.filter((m) => !DOWNLOADED_STATUSES.has(m.lifecycleStatus)), [imageGenerationModels]);
  const selectedModelRecord = useMemo(() => modelInventory.find((m) => m.modelRecordId === selectedModelRecordId), [modelInventory, selectedModelRecordId]);

  return { form, setForm, status, error, requestId, results, start, cancel, qualityNote, validationError: hasAttemptedGeneration ? validationError : undefined, isGenerateDisabled: ACTIVE_STATUSES.includes(status), isCancelDisabled: !(requestId && ["queued", "running", "starting", "finalizing"].includes(status)), createPreviewUrl: client.createArtifactMediaViewUrl, modelInventory, modelInventoryLoading, modelInventoryError, refreshModelInventory, selectedModelRecordId, setSelectedModelRecordId, selectedModelRecord, imageGenerationModels, downloadedImageGenerationModels, referenceOnlyImageGenerationModels };
}
