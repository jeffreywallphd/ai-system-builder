import { randomUUID } from "node:crypto";

import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import { isWorkspaceId } from "../../../contracts/workspace";
import { TaskType, type RuntimeTaskListRequest, type RuntimeTaskListResult, type RuntimeTaskRecord, type RuntimeTaskStatus, type StartRuntimeTaskRequest, type StartRuntimeTaskResult } from "../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../../application/ports/runtime/runtime-task-registry.port";
import type { ComfyUiHttpClient } from "./createComfyUiHttpClient";
import type { ComfyUiRuntimeDeviceMode, ComfyUiRuntimeSupervisor } from "./createComfyUiRuntimeSupervisor";
import { mapImageGenerationRequestToComfyUiPrompt, type ComfyUiImageGenerationWorkflowMapperOptions } from "./comfyUiImageGenerationWorkflowMapper";

interface Deps {
  client: Pick<ComfyUiHttpClient, "submitPrompt" | "getQueue" | "getHistory">;
  supervisor: Pick<ComfyUiRuntimeSupervisor, "start" | "getRecentRuntimeOutput" | "getRuntimeDeviceMode"> & {
    startWithRuntimeDeviceMode?: (request: { runtimeDeviceMode?: ComfyUiRuntimeDeviceMode }) => Promise<void>;
  };
  prepareLatentReferenceImage?: (request: {
    artifactId: string;
    imageRequest: ImageGenerationRequest;
  }) => Promise<{ imageName: string }>;
  prepareFaceReferenceImage?: (request: {
    artifactId: string;
    imageRequest: ImageGenerationRequest;
  }) => Promise<{ imageName: string }>;
  mapperOptions: ComfyUiImageGenerationWorkflowMapperOptions;
  now?: () => string;
}

const GENERIC_NO_OUTPUT_MESSAGE = "ComfyUI history entry did not contain image outputs.";

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function normalizeRequestedRuntimeDeviceMode(value: unknown): ComfyUiRuntimeDeviceMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized === "auto" || normalized === "cpu" || normalized === "directml" || normalized === "cuda"
    ? normalized
    : undefined;
}

function resolveRequestedRuntimeDeviceMode(request: ImageGenerationRequest): ComfyUiRuntimeDeviceMode | undefined {
  const hints = toRecord(request.engineHints);
  return normalizeRequestedRuntimeDeviceMode(hints?.runtimeDeviceMode);
}

function toShortTraceback(traceback: unknown): string | undefined {
  if (!Array.isArray(traceback)) return undefined;
  const lines = traceback.filter((line): line is string => typeof line === "string").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return undefined;
  return lines.slice(-3).join(" | ").slice(0, 360);
}

function resolveComfyUiFailure(historyRecord: Record<string, unknown>, runtimeOutput: string[]): { message: string; details?: Record<string, unknown> } {
  const status = toRecord(historyRecord.status);
  const statusStr = typeof status?.status_str === "string" ? status.status_str : undefined;
  const messages = Array.isArray(status?.messages) ? status?.messages : [];
  const normalizedMessages = messages.map((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return undefined;
    return toRecord(entry[1]);
  }).filter((entry): entry is Record<string, unknown> => Boolean(entry));

  const firstError = normalizedMessages.find((entry) => typeof entry.exception_message === "string" || typeof entry.error === "string");
  const exceptionMessage = typeof firstError?.exception_message === "string"
    ? firstError.exception_message
    : (typeof firstError?.error === "string" ? firstError.error : undefined);
  const nodeId = firstError?.node_id;
  const nodeType = typeof firstError?.node_type === "string" ? firstError.node_type : undefined;
  const tracebackSummary = toShortTraceback(firstError?.traceback);
  const statusMessage = normalizedMessages.map((entry) => typeof entry.message === "string" ? entry.message : undefined).find(Boolean);
  const runtimeSnippet = runtimeOutput.find((line) => /exception during processing|notimplementederror|error/i.test(line));

  const evidence = [statusStr, exceptionMessage, tracebackSummary, statusMessage, runtimeSnippet].filter((value): value is string => Boolean(value));
  const evidenceJoined = evidence.join(" ").toLowerCase();
  const isDirectMlFailure = evidenceJoined.includes("cannot access storage of opaquetensorimpl")
    || evidenceJoined.includes("privateuseone")
    || evidenceJoined.includes("torch-directml")
    || evidenceJoined.includes("directml");

  if (isDirectMlFailure && evidenceJoined.includes("cannot access storage of opaquetensorimpl")) {
    return {
      message: "ComfyUI failed during DirectML execution: Cannot access storage of OpaqueTensorImpl. This is a PyTorch/DirectML runtime failure, not a checkpoint-resolution failure. Try CPU mode or a smaller SD 1.5 checkpoint.",
      details: {
        exceptionMessage: exceptionMessage ?? "Cannot access storage of OpaqueTensorImpl",
        failedNodeId: nodeId,
        failedNodeType: nodeType,
        tracebackSummary,
      },
    };
  }

  const primary = exceptionMessage ?? statusMessage ?? statusStr ?? runtimeSnippet;
  if (!primary) {
    return { message: GENERIC_NO_OUTPUT_MESSAGE };
  }

  return {
    message: `ComfyUI failed: ${primary}`,
    details: { exceptionMessage, failedNodeId: nodeId, failedNodeType: nodeType, tracebackSummary },
  };
}

export function createComfyUiImageGenerationRuntimeAdapter(deps: Deps): RuntimeTaskRegistryPort {
  const byRequest = new Map<string, { promptId: string; request: ImageGenerationRequest; submittedAt: string; workspaceId: string }>();
  const finalResults = new Map<string, RuntimeTaskRecord>();
  const now = deps.now ?? (() => new Date().toISOString());

  const unknown = (requestId: string): RuntimeTaskRecord => ({
    requestId,
    taskType: TaskType.IMAGE_GENERATION,
    status: "unknown",
    concurrencyClass: "gpu-exclusive",
    error: {
      code: "comfyui_task_not_found",
      message: "ComfyUI image generation task was not found in the current-process registry.",
      details: { reason: "request-id-not-tracked" },
      retryable: false,
    },
    metadata: { engine: "comfyui", reason: "request-id-not-tracked" },
    updatedAt: now(),
  });

  const matchesListRequest = (record: RuntimeTaskRecord, request: RuntimeTaskListRequest): boolean => {
    if (!isWorkspaceId(request.workspaceId)) return false;
    if (record.workspaceId !== request.workspaceId) return false;
    if (request.taskTypes && request.taskTypes.length > 0 && !request.taskTypes.includes(record.taskType)) return false;
    if (request.statuses && request.statuses.length > 0 && !request.statuses.includes(record.status)) return false;
    if (!request.includeCompleted && (record.status === "succeeded" || record.status === "failed" || record.status === "cancelled")) return false;
    return true;
  };

  const taskRecordFromTracked = (requestId: string, tracked: { promptId: string; request: ImageGenerationRequest; submittedAt: string; workspaceId: string }): RuntimeTaskRecord => ({
    requestId,
    workspaceId: tracked.workspaceId as never,
    taskType: TaskType.IMAGE_GENERATION,
    status: "queued",
    concurrencyClass: "gpu-exclusive",
    progress: { message: "Accepted by the ComfyUI runtime task registry.", details: { promptId: tracked.promptId } },
    startedAt: tracked.submittedAt,
    updatedAt: tracked.submittedAt,
    metadata: {
      workspaceId: tracked.workspaceId,
      engine: "comfyui",
      comfyUiPromptId: tracked.promptId,
      request: {
        prompt: tracked.request.prompt,
        negativePrompt: tracked.request.negativePrompt,
        seed: tracked.request.seed,
        model: tracked.request.model,
        width: tracked.request.width,
        height: tracked.request.height,
      },
    },
  });

  return {
    async startTask(request: StartRuntimeTaskRequest) {
      if (request.taskType !== TaskType.IMAGE_GENERATION) {
        throw new Error(`ComfyUI runtime adapter only supports ${TaskType.IMAGE_GENERATION} tasks.`);
      }
      if (!isWorkspaceId(request.workspaceId)) {
        throw new Error("Workspace id is required for image generation runtime tasks.");
      }
      const imageRequest = request.payload as ImageGenerationRequest;
      const requestedRuntimeDeviceMode = resolveRequestedRuntimeDeviceMode(imageRequest);
      if (deps.supervisor.startWithRuntimeDeviceMode) {
        await deps.supervisor.startWithRuntimeDeviceMode({ runtimeDeviceMode: requestedRuntimeDeviceMode });
      } else {
        await deps.supervisor.start();
      }
      const latentReference = imageRequest.latentSource?.kind === "artifact"
        ? await deps.prepareLatentReferenceImage?.({
            artifactId: imageRequest.latentSource.artifactId,
            imageRequest,
          })
        : undefined;
      if (imageRequest.latentSource?.kind === "artifact" && !latentReference?.imageName) {
        throw new Error("Image generation latent artifact reference could not be prepared for ComfyUI.");
      }
      const faceReferenceImageNames = imageRequest.faceId?.enabled
        ? (await Promise.all(
            (imageRequest.faceId.references ?? []).slice(0, 3).map(async (reference) => {
              const artifactId = reference.artifactId.trim();
              if (!artifactId) return undefined;
              const prepared = await (deps.prepareFaceReferenceImage ?? deps.prepareLatentReferenceImage)?.({
                artifactId,
                imageRequest,
              });
              return prepared?.imageName;
            }),
          )).filter((imageName): imageName is string => Boolean(imageName))
        : [];
      if (imageRequest.faceId?.enabled && (imageRequest.faceId.references ?? []).length > 0 && faceReferenceImageNames.length === 0) {
        throw new Error("Image generation face reference artifact could not be prepared for ComfyUI.");
      }
      const payload = mapImageGenerationRequestToComfyUiPrompt(imageRequest, {
        ...deps.mapperOptions,
        latentReferenceImageName: latentReference?.imageName,
        faceReferenceImageNames,
      });
      const submitted = await deps.client.submitPrompt(payload);
      const requestId = request.requestId ?? randomUUID();
      const submittedAt = now();
      byRequest.set(requestId, { promptId: submitted.prompt_id, request: imageRequest, submittedAt, workspaceId: request.workspaceId });
      return {
        requestId,
        status: submitted.number === undefined ? "running" : "queued",
        metadata: {
          workspaceId: request.workspaceId,
          engine: "comfyui",
          comfyUiPromptId: submitted.prompt_id,
          submittedAt,
          requestedRuntimeDeviceMode,
          runtimeDeviceMode: deps.supervisor.getRuntimeDeviceMode?.(),
        },
      } as StartRuntimeTaskResult;
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
        const failure = status === "failed" ? resolveComfyUiFailure(historyRecord, deps.supervisor.getRecentRuntimeOutput?.() ?? []) : undefined;
        const record: RuntimeTaskRecord = {
          requestId, workspaceId: tracked.workspaceId as never, taskType: TaskType.IMAGE_GENERATION, status, concurrencyClass: "gpu-exclusive",
          data: status === "succeeded" ? { outputs: outputs.map((output) => ({ ...output, workspaceId: tracked.workspaceId })) } : undefined,
          error: status === "failed" ? { code: "comfyui_failed", message: failure?.message ?? GENERIC_NO_OUTPUT_MESSAGE, details: failure?.details } : undefined,
          completedAt: now(), updatedAt: now(),
          metadata: {
            workspaceId: tracked.workspaceId,
            engine: "comfyui",
            comfyUiPromptId: tracked.promptId,
            runtimeDeviceMode: deps.supervisor.getRuntimeDeviceMode?.(),
            request: {
              prompt: tracked.request.prompt,
              negativePrompt: tracked.request.negativePrompt,
              seed: tracked.request.seed,
              model: tracked.request.model,
              width: tracked.request.width,
              height: tracked.request.height,
            },
            ...(failure?.details ?? {}),
          },
        };
        finalResults.set(requestId, record);
        return record;
      }

      const pending = queue.queue_pending.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      const running = queue.queue_running.some((entry) => Array.isArray(entry) && String(entry[1] ?? "") === tracked.promptId);
      if (pending || running) {
        return { requestId, workspaceId: tracked.workspaceId as never, taskType: TaskType.IMAGE_GENERATION, status: pending ? "queued" : "running", concurrencyClass: "gpu-exclusive", progress: { message: pending ? "Queued in ComfyUI." : "Running in ComfyUI.", details: { promptId: tracked.promptId, queue } }, startedAt: tracked.submittedAt, updatedAt: now(), metadata: { workspaceId: tracked.workspaceId, engine: "comfyui", comfyUiPromptId: tracked.promptId } };
      }
      return { requestId, workspaceId: tracked.workspaceId as never, taskType: TaskType.IMAGE_GENERATION, status: "unknown", concurrencyClass: "gpu-exclusive", error: { code: "comfyui_task_missing", message: "ComfyUI prompt was not found in queue or history." }, startedAt: tracked.submittedAt, updatedAt: now(), metadata: { workspaceId: tracked.workspaceId, engine: "comfyui", comfyUiPromptId: tracked.promptId } };
    },

    async cancelTask(requestId) {
      if (!byRequest.has(requestId) && !finalResults.has(requestId)) {
        return { requestId, cancelled: false, status: "unknown", message: "Runtime task was not found in this task registry delegate." };
      }
      return { requestId, cancelled: false, status: finalResults.get(requestId)?.status ?? "running", message: "ComfyUI image generation cancellation is not implemented yet." };
    },
    async listTasks(request: RuntimeTaskListRequest): Promise<RuntimeTaskListResult> {
      const records = new Map<string, RuntimeTaskRecord>();
      for (const [requestId, tracked] of byRequest.entries()) {
        records.set(requestId, finalResults.get(requestId) ?? taskRecordFromTracked(requestId, tracked));
      }
      for (const [requestId, record] of finalResults.entries()) {
        records.set(requestId, record);
      }
      const tasks = [...records.values()].filter((record) => matchesListRequest(record, request));
      return { tasks: typeof request.limit === "number" ? tasks.slice(0, Math.max(0, request.limit)) : tasks };
    },
  };
}
