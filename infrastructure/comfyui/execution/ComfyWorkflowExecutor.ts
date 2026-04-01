import type {
  IComfyAdapterCapabilities,
  IComfyAdapterLifecycleEvent,
  IComfyAdapterRequest,
  IComfyAdapterResult,
  IComfyExecutionAdapter,
} from "../../../application/execution/comfyui/ComfyAdapterContract";
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
import { mapComfyError, mapComfyProgressToLifecycleEvent } from "./ComfyExecutionLifecycle";
import {
  ComfyQueueClient,
  type IComfyPromptCompletion,
  type IComfyPromptOutputArtifact,
  type IComfyPromptProgress,
} from "./ComfyQueueClient";

export interface IComfyWorkflowExecutorOptions {
  readonly workflowAdapter?: ComfyWorkflowAdapter;
  readonly queueClient: ComfyQueueClient;
}

export class ComfyWorkflowExecutor implements IWorkflowExecutor, IComfyExecutionAdapter {
  private readonly workflowAdapter: ComfyWorkflowAdapter;
  private readonly queueClient: ComfyQueueClient;

  public readonly capabilities: IComfyAdapterCapabilities = Object.freeze({
    runtimeId: "comfyui",
    supportsCancellation: true,
    supportsProgressPolling: true,
    supportsAssetReferences: true,
  });

  constructor(options: IComfyWorkflowExecutorOptions) {
    this.workflowAdapter = options.workflowAdapter ?? new ComfyWorkflowAdapter();
    this.queueClient = options.queueClient;
  }

  public async start(
    request: IComfyAdapterRequest,
    onLifecycleEvent?: (event: IComfyAdapterLifecycleEvent) => void
  ): Promise<{
    readonly executionId: string;
    cancel(): Promise<void>;
    waitForCompletion(): Promise<IComfyAdapterResult>;
  }> {
    const effectiveWorkflow = this.applyPropertyOverrides(
      request.workflow,
      request.propertyOverrides
    );

    const envelope = this.workflowAdapter.adaptWorkflowEnvelope(effectiveWorkflow);
    const queued = await this.queueClient.enqueuePrompt(envelope);
    const promptId = queued.prompt_id?.trim();

    if (!promptId) {
      throw new Error("ComfyUI did not return a prompt_id.");
    }

    const lifecycle: IComfyAdapterLifecycleEvent[] = [];

    const emitLifecycle = (event: IComfyAdapterLifecycleEvent): void => {
      lifecycle.push(event);
      onLifecycleEvent?.(event);
    };

    emitLifecycle(
      Object.freeze({
        executionId: promptId,
        status: "queued",
        percent: 0,
        message: "Prompt queued in ComfyUI.",
      })
    );

    return Object.freeze({
      executionId: promptId,
      cancel: async () => {
        await this.queueClient.cancelPrompt(promptId);
        emitLifecycle(
          Object.freeze({
            executionId: promptId,
            status: "cancelled",
            message: "Workflow cancelled.",
          })
        );
      },
      waitForCompletion: async (): Promise<IComfyAdapterResult> => {
        try {
          const completion = await this.queueClient.waitForCompletion(
            promptId,
            (progress) => emitLifecycle(mapComfyProgressToLifecycleEvent(progress))
          );

          return Object.freeze({
            executionId: promptId,
            status: "completed",
            outputs: this.mapNormalizedOutputs(completion),
            lifecycle: Object.freeze(lifecycle.slice()),
            messages: completion.messages,
          });
        } catch (error: unknown) {
          const normalizedError = mapComfyError(error);
          return Object.freeze({
            executionId: promptId,
            status:
              normalizedError.code === "execution-cancelled"
                ? "cancelled"
                : "failed",
            outputs: [],
            lifecycle: Object.freeze(lifecycle.slice()),
            error: normalizedError,
            messages: [normalizedError.message],
          });
        }
      },
    });
  }

  public async startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle> {
    if (!this.canExecute(input)) {
      throw new Error(
        `ComfyWorkflowExecutor cannot execute workflow '${input.workflow.id}'.`
      );
    }

    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();
    let currentProgress = new WorkflowExecutionProgress({
      executionId: input.workflow.id,
      status: "queued",
      percent: 0,
      message: "Preparing ComfyUI execution.",
    });

    const started = await this.start(
      {
        workflow: input.workflow,
        propertyOverrides: input.propertyOverrides,
        runtimeParameters: input.parameters,
        context: {
          metadata: input.executionMetadata,
        },
        inputAssetRefs: (input.inputAssets ?? []).map((asset) => ({
          assetId: asset.id,
          versionId: asset.latestVersion?.version,
        })),
      },
      (lifecycleEvent) => {
        const workflowEvent = this.toWorkflowExecutionEvent(lifecycleEvent);
        if (workflowEvent.progress) {
          currentProgress = WorkflowExecutionProgress.from(workflowEvent.progress);
        }

        for (const listener of listeners) {
          listener(workflowEvent);
        }
      }
    );

    const completionPromise = (async (): Promise<IWorkflowExecutionResult> => {
      const adapterResult = await started.waitForCompletion();
      const outputAssets = this.mapAssetsFromAdapterResult(input.workflow, adapterResult);

      if (adapterResult.status === "completed") {
        for (const asset of outputAssets) {
          for (const listener of listeners) {
            listener(
              new WorkflowExecutionEvent({
                executionId: adapterResult.executionId,
                kind: "asset-produced",
                status: "completed",
                asset,
              })
            );
          }
        }
      }

      return new WorkflowExecutionResult({
        executionId: adapterResult.executionId,
        status: adapterResult.status,
        outputAssets,
        messages: adapterResult.messages,
        errorMessage: adapterResult.error?.message,
      });
    })();

    return new WorkflowExecutionHandle({
      executionId: started.executionId,
      input,
      initialProgress: currentProgress,
      completionPromise,
      cancel: started.cancel,
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

  private toWorkflowExecutionEvent(
    lifecycleEvent: IComfyAdapterLifecycleEvent
  ): IWorkflowExecutionEvent {
    return new WorkflowExecutionEvent({
      executionId: lifecycleEvent.executionId,
      kind: "workflow-progress",
      status: lifecycleEvent.status,
      progress: new WorkflowExecutionProgress({
        executionId: lifecycleEvent.executionId,
        status: lifecycleEvent.status,
        percent: lifecycleEvent.percent,
        message: lifecycleEvent.message,
      }),
      message: lifecycleEvent.message,
      payload:
        lifecycleEvent.queuePosition !== undefined
          ? { queuePosition: lifecycleEvent.queuePosition }
          : undefined,
    });
  }

  private mapNormalizedOutputs(
    completion: IComfyPromptCompletion
  ): ReadonlyArray<{
    readonly nodeId: string;
    readonly kind: "image" | "video" | "audio" | "text";
    readonly reference: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> {
    const normalized: Array<{
      readonly nodeId: string;
      readonly kind: "image" | "video" | "audio" | "text";
      readonly reference: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }> = [];

    for (const [nodeId, artifacts] of Object.entries(completion.outputs)) {
      artifacts.forEach((artifact, index) => {
        if (artifact.kind === "text") {
          normalized.push({
            nodeId,
            kind: "text",
            reference: `${completion.promptId}:${nodeId}:text:${index}`,
            metadata: { text: artifact.text ?? "" },
          });
          return;
        }

        if (!artifact.filename) {
          return;
        }

        normalized.push({
          nodeId,
          kind: artifact.kind,
          reference: `${completion.promptId}:${nodeId}:${artifact.kind}:${artifact.filename}`,
          metadata: {
            filename: artifact.filename,
            subfolder: artifact.subfolder,
            type: artifact.type,
            format: artifact.format,
          },
        });
      });
    }

    return Object.freeze(normalized);
  }

  private mapAssetsFromAdapterResult(
    workflow: IWorkflow,
    result: IComfyAdapterResult
  ): ReadonlyArray<IAsset> {
    return Object.freeze(
      result.outputs.flatMap((output) => {
        if (output.kind === "text") {
          return [
            this.createTextAsset({
              workflow,
              executionId: result.executionId,
              nodeId: output.nodeId,
              reference: output.reference,
              text: typeof output.metadata?.text === "string" ? output.metadata.text : "",
            }),
          ];
        }

        return [
          this.createFileAsset({
            workflow,
            executionId: result.executionId,
            nodeId: output.nodeId,
            kind: output.kind,
            filename:
              typeof output.metadata?.filename === "string"
                ? output.metadata.filename
                : output.reference,
            subfolder:
              typeof output.metadata?.subfolder === "string"
                ? output.metadata.subfolder
                : undefined,
            type:
              typeof output.metadata?.type === "string"
                ? output.metadata.type
                : undefined,
            format:
              typeof output.metadata?.format === "string"
                ? output.metadata.format
                : undefined,
          }),
        ];
      })
    );
  }

  private createTextAsset(params: {
    readonly workflow: IWorkflow;
    readonly executionId: string;
    readonly nodeId: string;
    readonly reference: string;
    readonly text: string;
  }): IAsset {
    return new Asset({
      id: params.reference,
      name: `${params.workflow.metadata.name}-${params.nodeId}-text`,
      kind: "text",
      status: "available",
      source: new AssetSourceInfo({
        type: "generated",
        workflowId: params.workflow.id,
        nodeId: params.nodeId,
        executionId: params.executionId,
        runtime: "comfyui" as never,
        provider: "comfyui",
      }),
      location: new AssetLocation({
        accessMethod: "virtual",
        location: undefined,
        format: "txt",
        contentType: "text/plain",
      }),
      technicalMetadata: new AssetTechnicalMetadata({}),
      semanticMetadata: new AssetSemanticMetadata({
        description: params.text,
        tags: ["comfyui", "text-output"],
      }),
      relationships: [],
      audit: new AssetAuditInfo({ createdAt: new Date(), updatedAt: new Date() }),
    });
  }

  private createFileAsset(params: {
    readonly workflow: IWorkflow;
    readonly executionId: string;
    readonly nodeId: string;
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
    readonly kind: IAsset["kind"];
    readonly format?: string;
  }): IAsset {
    const url = this.queueClient.buildViewUrl({
      filename: params.filename,
      subfolder: params.subfolder,
      type: params.type,
    });

    return new Asset({
      id: `${params.executionId}:${params.nodeId}:${params.kind}:${params.filename}`,
      name: params.filename,
      kind: params.kind,
      status: "available",
      source: new AssetSourceInfo({
        type: "generated",
        workflowId: params.workflow.id,
        nodeId: params.nodeId,
        executionId: params.executionId,
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
      semanticMetadata: new AssetSemanticMetadata({ tags: ["comfyui", params.kind] }),
      relationships: [],
      audit: new AssetAuditInfo({ createdAt: new Date(), updatedAt: new Date() }),
    });
  }
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
