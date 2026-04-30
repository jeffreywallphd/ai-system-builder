import { randomUUID } from "node:crypto";

import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import { TaskType, type RuntimeTaskListRequest, type RuntimeTaskListResult, type RuntimeTaskRecord, type RuntimeTaskStatus, type StartRuntimeTaskRequest, type StartRuntimeTaskResult } from "../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../../application/ports/runtime/runtime-task-registry.port";
import type { ComfyUiHttpClient } from "./createComfyUiHttpClient";
import type { ComfyUiRuntimeSupervisor } from "./createComfyUiRuntimeSupervisor";
import { mapImageGenerationRequestToComfyUiPrompt, type ComfyUiImageGenerationWorkflowMapperOptions } from "./comfyUiImageGenerationWorkflowMapper";

interface Deps { client: Pick<ComfyUiHttpClient, "submitPrompt" | "getQueue" | "getHistory">; supervisor: Pick<ComfyUiRuntimeSupervisor, "start">; mapperOptions: ComfyUiImageGenerationWorkflowMapperOptions; now?: () => string; }

export function createComfyUiImageGenerationRuntimeAdapter(deps: Deps): RuntimeTaskRegistryPort {
  const byRequest = new Map<string, { promptId: string; request: ImageGenerationRequest; submittedAt: string }>();
  const finalResults = new Map<string, RuntimeTaskRecord>();
  const now = deps.now ?? (() => new Date().toISOString());

  const unknown = (requestId: string): RuntimeTaskRecord => ({ requestId, taskType: TaskType.IMAGE_GENERATION, status: "unknown", concurrencyClass: "gpu-exclusive", updatedAt: now() });

  return {
    async startTask(request: StartRuntimeTaskRequest) {
      if (request.taskType !== TaskType.IMAGE_GENERATION) {
        throw new Error(`ComfyUI runtime adapter only supports ${TaskType.IMAGE_GENERATION} tasks.`);
      }
      const imageRequest = request.payload as ImageGenerationRequest;
      await deps.supervisor.start();
      const payload = mapImageGenerationRequestToComfyUiPrompt(imageRequest, deps.mapperOptions);
      const submitted = await deps.client.submitPrompt(payload);
      const requestId = request.requestId ?? randomUUID();
      const submittedAt = now();
      byRequest.set(requestId, { promptId: submitted.prompt_id, request: imageRequest, submittedAt });
      return { requestId, status: submitted.number === undefined ? "running" : "queued", metadata: { engine: "comfyui", comfyUiPromptId: submitted.prompt_id, submittedAt } } as StartRuntimeTaskResult;
    },

    async getTaskStatus(requestId) {
      const existing = finalResults.get(requestId);
      if (existing) return existing;
      const tracked = byRequest.get(requestId);
      if (!tracked) return unknown(requestId);

      const [queue, history] = await Promise.all([deps.client.getQueue(), deps.client.getHistory()]);
      const historyRecord = history[tracked.promptId] as Record<string, unknown> | undefined;
      if (historyRecord) {
        const outputsRecord = (historyRecord.outputs ?? {}) as Record<string, { images?: Array<Record<string, unknown>> }>;
        const outputs = Object.values(outputsRecord).flatMap((n) => (n.images ?? []).map((image) => ({ fileName: String(image.filename ?? ""), subfolder: image.subfolder ? String(image.subfolder) : undefined, promptId: tracked.promptId, engine: "comfyui", type: "image" })));
        const status: RuntimeTaskStatus = outputs.length > 0 ? "succeeded" : "failed";
        const record: RuntimeTaskRecord = { requestId, taskType: TaskType.IMAGE_GENERATION, status, concurrencyClass: "gpu-exclusive", data: status === "succeeded" ? { outputs } : undefined, error: status === "failed" ? { code: "comfyui_failed", message: "ComfyUI history entry did not contain image outputs." } : undefined, completedAt: now(), updatedAt: now(), metadata: { engine: "comfyui", comfyUiPromptId: tracked.promptId } };
        finalResults.set(requestId, record);
        return record;
      }

      const pending = queue.queue_pending.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      const running = queue.queue_running.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      if (pending || running) {
        return { requestId, taskType: TaskType.IMAGE_GENERATION, status: pending ? "queued" : "running", concurrencyClass: "gpu-exclusive", progress: { message: pending ? "Queued in ComfyUI." : "Running in ComfyUI.", details: { promptId: tracked.promptId, queue } }, startedAt: tracked.submittedAt, updatedAt: now(), metadata: { engine: "comfyui", comfyUiPromptId: tracked.promptId } };
      }
      return { requestId, taskType: TaskType.IMAGE_GENERATION, status: "unknown", concurrencyClass: "gpu-exclusive", error: { code: "comfyui_task_missing", message: "ComfyUI prompt was not found in queue or history." }, startedAt: tracked.submittedAt, updatedAt: now(), metadata: { engine: "comfyui", comfyUiPromptId: tracked.promptId } };
    },

    async cancelTask(requestId) {
      return { requestId, cancelled: false, status: byRequest.has(requestId) ? "running" : "unknown", message: "ComfyUI image generation cancellation is not implemented yet." };
    },
    async listTasks(_request: RuntimeTaskListRequest): Promise<RuntimeTaskListResult> {
      return { tasks: [] };
    },
  };
}
