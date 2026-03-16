import { Asset } from "../../../domain/assets/Asset";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../../../domain/assets/AssetMetadata";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
} from "../../../application/ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../../../application/ports/interfaces/IWorkflowExecutor";
import { ComfyWorkflowAdapter } from "../adapters/ComfyWorkflowAdapter";
import type {
  ComfyHistoryPromptEntryDto,
  ComfyHistoryPromptOutputDto,
  ComfyWorkflowDto,
} from "../dto/ComfyWorkflowDto";
import { ComfyApiClient } from "./ComfyApiClient";
import { ComfyQueueClient, type IComfyPromptProgress } from "./ComfyQueueClient";

export interface IComfyWorkflowExecutorOptions {
  readonly workflowAdapter?: ComfyWorkflowAdapter;
  readonly apiClient: ComfyApiClient;
  readonly queueClient: ComfyQueueClient;
}

export class ComfyWorkflowExecutor implements IWorkflowExecutor {
  private readonly workflowAdapter: ComfyWorkflowAdapter;
  private readonly apiClient: ComfyApiClient;
  private readonly queueClient: ComfyQueueClient;

  constructor(options: IComfyWorkflowExecutorOptions) {
    this.workflowAdapter = options.workflowAdapter ?? new ComfyWorkflowAdapter();
    this.apiClient = options.apiClient;
    this.queueClient = options.queueClient;
  }

  public async startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle> {
    if (!this.canExecute(input)) {
      throw new Error(
        `ComfyWorkflowExecutor cannot execute workflow '${input.workflow.id}'.`
      );
    }

    const effectiveWorkflow = this.applyPropertyOverrides(
      input.workflow,
      input.propertyOverrides
    );

    const envelope = this.workflowAdapter.adaptWorkflowEnvelope(
      effectiveWorkflow
    ) as ComfyWorkflowDto;
    const queued = await this.queueClient.enqueuePrompt(envelope);
    const promptId = queued.prompt_id;

    if (!promptId?.trim()) {
      throw new Error("ComfyUI did not return a prompt_id.");
    }

    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();

    let currentProgress = new WorkflowExecutionProgress({
      executionId: promptId,
      status: "queued",
      percent: 0,
      message: "Prompt queued in ComfyUI.",
    });

    const emit = (event: IWorkflowExecutionEvent): void => {
      if (event.progress) {
        currentProgress = WorkflowExecutionProgress.from(event.progress);
      }

      for (const listener of listeners) {
        listener(event);
      }
    };

    emit(
      new WorkflowExecutionEvent({
        executionId: promptId,
        kind: "workflow-started",
        status: "queued",
        progress: currentProgress,
        message: "Workflow submitted to ComfyUI.",
      })
    );

    const completionPromise = (async (): Promise<IWorkflowExecutionResult> => {
      try {
        const historyEntry = await this.queueClient.waitForCompletion(
          promptId,
          (progress) => {
            const event = this.toProgressEvent(progress);
            emit(event);
          }
        );

        const outputAssets = this.mapAssetsFromHistory(
          effectiveWorkflow,
          promptId,
          historyEntry
        );

        const result = new WorkflowExecutionResult({
          executionId: promptId,
          status: "completed",
          outputAssets,
          messages: historyEntry.status?.messages?.map((message) =>
            typeof message === "string" ? message : JSON.stringify(message)
          ),
        });

        emit(
          new WorkflowExecutionEvent({
            executionId: promptId,
            kind: "workflow-completed",
            status: "completed",
            progress: new WorkflowExecutionProgress({
              executionId: promptId,
              status: "completed",
              percent: 100,
              message: "Workflow completed.",
            }),
            message: "Workflow completed.",
            payload: {
              outputAssetCount: outputAssets.length,
            },
          })
        );

        for (const asset of outputAssets) {
          emit(
            new WorkflowExecutionEvent({
              executionId: promptId,
              kind: "asset-produced",
              status: "completed",
              asset,
            })
          );
        }

        return result;
      } catch (error: unknown) {
        const result = new WorkflowExecutionResult({
          executionId: promptId,
          status: "failed",
          outputAssets: [],
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown ComfyUI execution error.",
        });

        emit(
          new WorkflowExecutionEvent({
            executionId: promptId,
            kind: "workflow-failed",
            status: "failed",
            progress: new WorkflowExecutionProgress({
              executionId: promptId,
              status: "failed",
              percent: currentProgress.percent,
              message: result.errorMessage,
            }),
            message: result.errorMessage,
          })
        );

        return result;
      }
    })();

    return new WorkflowExecutionHandle({
      executionId: promptId,
      input,
      initialProgress: currentProgress,
      completionPromise,
      cancel: async () => {
        await this.queueClient.cancelPrompt(promptId);
        emit(
          new WorkflowExecutionEvent({
            executionId: promptId,
            kind: "workflow-cancelled",
            status: "cancelled",
            progress: new WorkflowExecutionProgress({
              executionId: promptId,
              status: "cancelled",
              percent: currentProgress.percent,
              message: "Workflow cancelled.",
            }),
            message: "Workflow cancelled.",
          })
        );
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    });
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const handle = await this.startExecution(input);

    let unsubscribe: (() => void) | undefined;

    if (onEvent && typeof handle.subscribe === "function") {
      const maybeUnsubscribe = await handle.subscribe(onEvent);
      unsubscribe =
        typeof maybeUnsubscribe === "function" ? maybeUnsubscribe : undefined;
    }

    try {
      return await handle.waitForCompletion();
    } finally {
      unsubscribe?.();
    }
  }

  public canExecute(input: IWorkflowExecutionInput): boolean {
    const runtime =
      typeof input.target?.runtime === "string"
        ? input.target.runtime.toLowerCase()
        : input.workflow.runtimeProfile?.preferredRuntime?.toLowerCase();

    if (runtime && runtime !== "comfyui") {
      return false;
    }

    return true;
  }

  private applyPropertyOverrides(
    workflow: IWorkflow,
    overrides?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  ): IWorkflow {
    if (!overrides || Object.keys(overrides).length === 0) {
      return workflow;
    }

    let updatedWorkflow = workflow;

    for (const [nodeId, propertyOverrides] of Object.entries(overrides)) {
      const node = updatedWorkflow.getNode(nodeId);

      if (!node) {
        throw new Error(`Property overrides reference unknown node '${nodeId}'.`);
      }

      let updatedNode = node;

      for (const [propertyId, value] of Object.entries(propertyOverrides)) {
        if (!updatedNode.getProperty(propertyId)) {
          throw new Error(
            `Property overrides reference unknown property '${propertyId}' on node '${nodeId}'.`
          );
        }

        updatedNode = updatedNode.withPropertyValue(propertyId, value);
      }

      updatedWorkflow = updatedWorkflow.updateNode(updatedNode);
    }

    return updatedWorkflow;
  }

  private toProgressEvent(progress: IComfyPromptProgress): IWorkflowExecutionEvent {
    const mappedStatus =
      progress.status === "queued"
        ? "running"
        : progress.status === "running"
          ? "running"
          : progress.status === "completed"
            ? "completed"
            : progress.status === "cancelled"
              ? "cancelled"
              : "failed";

    const executionProgress = new WorkflowExecutionProgress({
      executionId: progress.promptId,
      status: mappedStatus,
      percent:
        progress.status === "queued"
          ? 5
          : progress.status === "running"
            ? 50
            : progress.status === "completed"
              ? 100
              : undefined,
      message: progress.message,
    });

    return new WorkflowExecutionEvent({
      executionId: progress.promptId,
      kind: "workflow-progress",
      status: mappedStatus,
      progress: executionProgress,
      message: progress.message,
      payload:
        progress.queuePosition !== undefined
          ? { queuePosition: progress.queuePosition }
          : undefined,
    });
  }

  private mapAssetsFromHistory(
    workflow: IWorkflow,
    promptId: string,
    historyEntry: ComfyHistoryPromptEntryDto
  ): ReadonlyArray<IAsset> {
    const assets: IAsset[] = [];
    const outputs = historyEntry.outputs ?? {};

    for (const [nodeId, output] of Object.entries(outputs)) {
      assets.push(...this.mapNodeOutputAssets(workflow, promptId, nodeId, output));
    }

    return Object.freeze(assets);
  }

  private mapNodeOutputAssets(
    workflow: IWorkflow,
    promptId: string,
    nodeId: string,
    output: ComfyHistoryPromptOutputDto
  ): IAsset[] {
    const assets: IAsset[] = [];

    for (const image of output.images ?? []) {
      assets.push(
        this.createFileAsset({
          workflow,
          promptId,
          nodeId,
          filename: image.filename,
          subfolder: image.subfolder,
          type: image.type,
          kind: "image",
          format: getFileExtension(image.filename),
        })
      );
    }

    for (const gif of output.gifs ?? []) {
      assets.push(
        this.createFileAsset({
          workflow,
          promptId,
          nodeId,
          filename: gif.filename,
          subfolder: gif.subfolder,
          type: gif.type,
          kind: "video",
          format: gif.format || getFileExtension(gif.filename),
        })
      );
    }

    for (const audio of output.audio ?? []) {
      assets.push(
        this.createFileAsset({
          workflow,
          promptId,
          nodeId,
          filename: audio.filename,
          subfolder: audio.subfolder,
          type: audio.type,
          kind: "audio",
          format: audio.format || getFileExtension(audio.filename),
        })
      );
    }

    for (let index = 0; index < (output.text ?? []).length; index += 1) {
      const textOutput = output.text![index];

      assets.push(
        new Asset({
          id: `${promptId}:${nodeId}:text:${index}`,
          name: `${workflow.metadata.name}-${nodeId}-text-${index}`,
          kind: "text",
          status: "available",
          source: new AssetSourceInfo({
            type: "generated",
            workflowId: workflow.id,
            nodeId,
            executionId: promptId,
            runtime: "comfyui" as never,
            provider: "comfyui",
          }),
          location: new AssetLocation({
            accessMethod: "virtual",
            location: undefined,
            format: "txt",
            contentType: "text/plain",
          }),
          technicalMetadata: new AssetTechnicalMetadata({
            tokenCount: undefined,
          }),
          semanticMetadata: new AssetSemanticMetadata({
            description: textOutput.text,
            tags: ["comfyui", "text-output"],
          }),
          relationships: [],
          audit: new AssetAuditInfo({
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        })
      );
    }

    return assets;
  }

  private createFileAsset(params: {
    readonly workflow: IWorkflow;
    readonly promptId: string;
    readonly nodeId: string;
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
    readonly kind: IAsset["kind"];
    readonly format?: string;
  }): IAsset {
    const url = this.apiClient.buildViewUrl({
      filename: params.filename,
      subfolder: params.subfolder,
      type: params.type,
    });

    return new Asset({
      id: `${params.promptId}:${params.nodeId}:${params.kind}:${params.filename}`,
      name: params.filename,
      kind: params.kind,
      status: "available",
      source: new AssetSourceInfo({
        type: "generated",
        workflowId: params.workflow.id,
        nodeId: params.nodeId,
        executionId: params.promptId,
        runtime: "comfyui" as never,
        provider: "comfyui",
      }),
      location: new AssetLocation({
        accessMethod: "remote-url",
        location: url,
        format: params.format,
        contentType: inferContentType(params.kind, params.format),
      }),
      technicalMetadata: new AssetTechnicalMetadata({}),
      semanticMetadata: new AssetSemanticMetadata({
        tags: ["comfyui", params.kind],
      }),
      relationships: [],
      audit: new AssetAuditInfo({
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
  }
}

function getFileExtension(filename: string): string | undefined {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : undefined;
}

function inferContentType(
  kind: IAsset["kind"],
  format?: string
): string | undefined {
  const normalizedFormat = format?.trim().toLowerCase();

  if (kind === "image") {
    if (normalizedFormat === "png") return "image/png";
    if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") {
      return "image/jpeg";
    }

    if (normalizedFormat === "webp") return "image/webp";
    return "image/*";
  }

  if (kind === "video") {
    if (normalizedFormat === "gif") return "image/gif";
    if (normalizedFormat === "mp4") return "video/mp4";
    if (normalizedFormat === "webm") return "video/webm";
    return "video/*";
  }

  if (kind === "audio") {
    if (normalizedFormat === "wav") return "audio/wav";
    if (normalizedFormat === "mp3") return "audio/mpeg";
    if (normalizedFormat === "flac") return "audio/flac";
    return "audio/*";
  }

  if (kind === "text") {
    return "text/plain";
  }

  return undefined;
}
