import { randomUUID } from "node:crypto";

import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import { TaskType, type CancelRuntimeTaskResult, type RuntimeTaskRecord, type RuntimeTaskStatus, type StartRuntimeTaskResult } from "../../../contracts/runtime";
import type { ImageGenerationRuntimePort } from "../../../application/ports/image-generation";
import type { ComfyUiHttpClient } from "./createComfyUiHttpClient";
import type { ComfyUiRuntimeSupervisor } from "./createComfyUiRuntimeSupervisor";
import { mapImageGenerationRequestToComfyUiPrompt, type ComfyUiImageGenerationWorkflowMapperOptions } from "./comfyUiImageGenerationWorkflowMapper";

interface Deps { client: Pick<ComfyUiHttpClient, "submitPrompt" | "getQueue" | "getHistory">; supervisor: Pick<ComfyUiRuntimeSupervisor, "start">; mapperOptions: ComfyUiImageGenerationWorkflowMapperOptions; now?: () => string; }

export function createComfyUiImageGenerationRuntimeAdapter(deps: Deps): ImageGenerationRuntimePort {
  const byRequest = new Map<string, { promptId: string; request: ImageGenerationRequest; submittedAt: string }>();
  const finalResults = new Map<string, RuntimeTaskRecord>();
  const now = deps.now ?? (() => new Date().toISOString());

  const unknown = (requestId: string): RuntimeTaskRecord => ({ requestId, taskType: TaskType.IMAGE_GENERATION, status: "unknown", concurrencyClass: "gpu-exclusive", updatedAt: now() });

  return {
    async startImageGeneration(request, context) {
      await deps.supervisor.start();
      const payload = mapImageGenerationRequestToComfyUiPrompt(request, deps.mapperOptions);
      const submitted = await deps.client.submitPrompt(payload);
      const requestId = context?.requestId ?? randomUUID();
      const submittedAt = now();
      byRequest.set(requestId, { promptId: submitted.prompt_id, request, submittedAt });
      return { requestId, status: submitted.number === undefined ? "running" : "queued", metadata: { engine: "comfyui", comfyUiPromptId: submitted.prompt_id, submittedAt } } as StartRuntimeTaskResult;
    },

    async readImageGenerationTask(requestId) {
      const existing = finalResults.get(requestId);
      if (existing) return existing;
      const tracked = byRequest.get(requestId);
      if (!tracked) return unknown(requestId);

      const [queue, history] = await Promise.all([deps.client.getQueue(), deps.client.getHistory()]);
      const historyRecord = history[tracked.promptId] as Record<string, unknown> | undefined;
      if (historyRecord) {
        const outputsRecord = (historyRecord.outputs ?? {}) as Record<string, { images?: Array<Record<string, unknown>> }>;
        const outputs = Object.values(outputsRecord).flatMap((n) => (n.images ?? []).map((image) => ({ fileName: String(image.filename ?? ""), subfolder: image.subfolder ? String(image.subfolder) : undefined, type: image.type ? String(image.type) : undefined, comfyUiPromptId: tracked.promptId, engine: "comfyui" })));
        const status: RuntimeTaskStatus = outputs.length > 0 ? "succeeded" : "failed";
        const record: RuntimeTaskRecord = { requestId, taskType: TaskType.IMAGE_GENERATION, status, concurrencyClass: "gpu-exclusive", data: status === "succeeded" ? { outputs } : undefined, error: status === "failed" ? { code: "comfyui_failed", message: "ComfyUI history entry did not contain image outputs." } : undefined, completedAt: now(), updatedAt: now(), metadata: { engine: "comfyui", comfyUiPromptId: tracked.promptId } };
        finalResults.set(requestId, record);
        return record;
      }

      const pending = queue.queue_pending.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      const running = queue.queue_running.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      return { requestId, taskType: TaskType.IMAGE_GENERATION, status: pending ? "queued" : running ? "running" : "running", concurrencyClass: "gpu-exclusive", progress: { message: pending ? "Queued in ComfyUI." : "Running in ComfyUI.", details: { promptId: tracked.promptId, queue } }, startedAt: tracked.submittedAt, updatedAt: now(), metadata: { engine: "comfyui", comfyUiPromptId: tracked.promptId } };
    },

    async cancelImageGenerationTask(requestId): Promise<CancelRuntimeTaskResult> {
      return { requestId, cancelled: false, status: byRequest.has(requestId) ? "running" : "unknown", message: "ComfyUI image generation cancellation is not implemented yet." };
    },
  };
}
