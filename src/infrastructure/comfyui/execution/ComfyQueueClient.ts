import type { ComfyQueueStateDto, ComfyWorkflowDto } from "../dto/ComfyWorkflowDto";
import { ComfyApiClient } from "./ComfyApiClient";
import type { ComfyAdapterConfig } from "./ComfyAdapterConfig";

export interface IComfyQueueClientOptions {
  readonly apiClient: ComfyApiClient;
  readonly pollIntervalMs?: number;
  readonly maxWaitMs?: number;
  readonly config?: ComfyAdapterConfig;
}

export interface IComfyPromptOutputArtifact {
  readonly kind: "image" | "video" | "audio" | "text";
  readonly filename?: string;
  readonly subfolder?: string;
  readonly type?: string;
  readonly format?: string;
  readonly text?: string;
}

export interface IComfyPromptCompletion {
  readonly promptId: string;
  readonly messages: ReadonlyArray<string>;
  readonly outputs: Readonly<Record<string, ReadonlyArray<IComfyPromptOutputArtifact>>>;
}

export class ComfyPromptExecutionError extends Error {
  public readonly completion?: IComfyPromptCompletion;

  public constructor(message: string, completion?: IComfyPromptCompletion) {
    super(message);
    this.name = "ComfyPromptExecutionError";
    this.completion = completion;
  }
}

export interface IComfyPromptProgress {
  readonly promptId: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
  readonly message?: string;
  readonly queuePosition?: number;
  readonly completion?: IComfyPromptCompletion;
}

export class ComfyQueueClient {
  private readonly apiClient: ComfyApiClient;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(options: IComfyQueueClientOptions) {
    this.apiClient = options.apiClient;
    this.pollIntervalMs = options.pollIntervalMs ?? options.config?.pollIntervalMs ?? 1_000;
    this.maxWaitMs = options.maxWaitMs ?? options.config?.maxExecutionWaitMs ?? 1000 * 60 * 60;
  }

  public async enqueuePrompt(
    workflow: ComfyWorkflowDto
  ): Promise<{ readonly prompt_id?: string }> {
    const queued = await this.apiClient.queuePrompt(workflow);
    const nodeErrors = queued.node_errors;
    if (nodeErrors && Object.keys(nodeErrors).length > 0) {
      throw new ComfyPromptExecutionError(
        `ComfyUI rejected prompt because one or more nodes are invalid: ${JSON.stringify(nodeErrors)}`,
      );
    }
    return queued;
  }

  public async getPromptProgress(promptId: string): Promise<IComfyPromptProgress> {
    const normalizedPromptId = promptId.trim();

    if (!normalizedPromptId) {
      throw new Error("ComfyQueueClient.getPromptProgress requires a promptId.");
    }

    const history = await this.apiClient.getHistory(normalizedPromptId);
    const historyEntry = history[normalizedPromptId];

    if (historyEntry) {
      const completed = !!historyEntry.status?.completed;
      const statusStr = historyEntry.status?.status_str?.toLowerCase() ?? "";

      if (completed) {
        return Object.freeze({
          promptId: normalizedPromptId,
          status: "completed",
          message: historyEntry.status?.status_str,
          completion: normalizeCompletion(normalizedPromptId, historyEntry),
        });
      }

      if (statusStr.includes("error") || statusStr.includes("failed")) {
        const completion = normalizeCompletion(normalizedPromptId, historyEntry);
        return Object.freeze({
          promptId: normalizedPromptId,
          status: "failed",
          message: historyEntry.status?.status_str,
          completion: hasCompletionOutputs(completion) ? completion : undefined,
        });
      }

      return Object.freeze({
        promptId: normalizedPromptId,
        status: "running",
        message: historyEntry.status?.status_str,
      });
    }

    const queue = await this.apiClient.getQueue();
    const queuePosition = this.findQueuePosition(queue, normalizedPromptId);

    if (queuePosition !== undefined) {
      return Object.freeze({
        promptId: normalizedPromptId,
        status: queuePosition === 0 ? "running" : "queued",
        queuePosition,
      });
    }

    return Object.freeze({
      promptId: normalizedPromptId,
      status: "queued",
    });
  }

  public async waitForCompletion(
    promptId: string,
    onProgress?: (progress: IComfyPromptProgress) => void
  ): Promise<IComfyPromptCompletion> {
    const startedAt = Date.now();
    const normalizedPromptId = promptId.trim();

    while (Date.now() - startedAt < this.maxWaitMs) {
      const progress = await this.getPromptProgress(normalizedPromptId);
      onProgress?.(progress);

      if (progress.status === "completed") {
        if (!progress.completion) {
          throw new Error(
            `ComfyUI prompt '${normalizedPromptId}' completed without a history entry.`
          );
        }

        return progress.completion;
      }

      if (progress.status === "failed") {
        throw new ComfyPromptExecutionError(
          `ComfyUI prompt '${normalizedPromptId}' failed: ${progress.message ?? "Unknown error"}`,
          progress.completion,
        );
      }

      if (progress.status === "cancelled") {
        throw new Error(`ComfyUI prompt '${normalizedPromptId}' was cancelled.`);
      }

      await delay(this.pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for ComfyUI prompt '${normalizedPromptId}' to complete.`
    );
  }

  public async cancelPrompt(_promptId: string): Promise<void> {
    await this.apiClient.interrupt();
  }

  public buildViewUrl(params: {
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
  }): string {
    return this.apiClient.buildViewUrl(params);
  }

  private findQueuePosition(
    queue: ComfyQueueStateDto,
    promptId: string
  ): number | undefined {
    const running = queue.queue_running ?? [];
    const pending = queue.queue_pending ?? [];

    const all = [...running, ...pending];

    for (let index = 0; index < all.length; index += 1) {
      const item = all[index];

      if (containsPromptId(item, promptId)) {
        return index;
      }
    }

    return undefined;
  }
}

function hasCompletionOutputs(completion: IComfyPromptCompletion): boolean {
  return Object.values(completion.outputs).some((artifacts) => artifacts.length > 0);
}

function normalizeCompletion(
  promptId: string,
  historyEntry: Readonly<Record<string, unknown>> & {
    readonly status?: { readonly messages?: ReadonlyArray<unknown> };
    readonly outputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  }
): IComfyPromptCompletion {
  const outputs: Record<string, ReadonlyArray<IComfyPromptOutputArtifact>> = {};

  for (const [nodeId, output] of Object.entries(historyEntry.outputs ?? {})) {
    const nodeArtifacts: IComfyPromptOutputArtifact[] = [];

    for (const image of asArray(output.images)) {
      nodeArtifacts.push({
        kind: "image",
        filename: asString(image.filename),
        subfolder: asString(image.subfolder),
        type: asString(image.type),
      });
    }

    for (const gif of asArray(output.gifs)) {
      nodeArtifacts.push({
        kind: "video",
        filename: asString(gif.filename),
        subfolder: asString(gif.subfolder),
        type: asString(gif.type),
        format: asString(gif.format),
      });
    }

    for (const audio of asArray(output.audio)) {
      nodeArtifacts.push({
        kind: "audio",
        filename: asString(audio.filename),
        subfolder: asString(audio.subfolder),
        type: asString(audio.type),
        format: asString(audio.format),
      });
    }

    for (const text of asArray(output.text)) {
      nodeArtifacts.push({ kind: "text", text: asString(text.text) });
    }

    outputs[nodeId] = Object.freeze(nodeArtifacts);
  }

  return Object.freeze({
    promptId,
    messages: Object.freeze(
      (historyEntry.status?.messages ?? []).map((message) =>
        typeof message === "string" ? message : JSON.stringify(message)
      )
    ),
    outputs: Object.freeze(outputs),
  });
}

function asArray(value: unknown): ReadonlyArray<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function containsPromptId(value: unknown, promptId: string): boolean {
  if (typeof value === "string") {
    return value === promptId;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsPromptId(item, promptId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsPromptId(item, promptId));
  }

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
