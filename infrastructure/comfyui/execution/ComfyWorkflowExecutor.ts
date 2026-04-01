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
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../../../application/ports/interfaces/IWorkflowExecutor";
import type {
  IComfyAdapterLifecycleEvent,
  IComfyAdapterRequest,
  IComfyAdapterResult,
  IComfyExecutionAdapter,
} from "../../../application/execution/comfyui/ComfyAdapterContract";
import { ComfyExecutionService } from "../../../application/execution/comfyui/ComfyExecutionService";
import { mapComfyError, mapComfyProgressToLifecycleEvent } from "./ComfyExecutionLifecycle";
import { ComfyQueueClient } from "./ComfyQueueClient";
import { ComfyExecutionRequestMapper } from "./mappers/ComfyExecutionRequestMapper";
import { ComfyExecutionResultMapper } from "./mappers/ComfyExecutionResultMapper";

export interface IComfyWorkflowExecutorOptions {
  readonly adapter: IComfyExecutionAdapter;
  readonly buildViewUrl?: (params: {
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
  }) => string;
}

export interface IComfyQueueExecutionAdapterOptions {
  readonly queueClient: ComfyQueueClient;
  readonly requestMapper?: ComfyExecutionRequestMapper;
  readonly resultMapper?: ComfyExecutionResultMapper;
}

export class ComfyQueueExecutionAdapter implements IComfyExecutionAdapter {
  public readonly capabilities = Object.freeze({
    runtimeId: "comfyui" as const,
    supportsCancellation: true,
    supportsProgressPolling: true,
    supportsAssetReferences: true,
  });

  private readonly requestMapper: ComfyExecutionRequestMapper;
  private readonly resultMapper: ComfyExecutionResultMapper;

  constructor(private readonly options: IComfyQueueExecutionAdapterOptions) {
    this.requestMapper = options.requestMapper ?? new ComfyExecutionRequestMapper();
    this.resultMapper = options.resultMapper ?? new ComfyExecutionResultMapper();
  }

  public async start(
    request: IComfyAdapterRequest,
    onLifecycleEvent?: (event: IComfyAdapterLifecycleEvent) => void,
  ): Promise<{
    readonly executionId: string;
    cancel(): Promise<void>;
    waitForCompletion(): Promise<IComfyAdapterResult>;
  }> {
    const mapped = this.requestMapper.map(request);
    const queued = await this.options.queueClient.enqueuePrompt(mapped.payload);
    const promptId = queued.prompt_id?.trim();

    if (!promptId) {
      throw new Error("ComfyUI did not return a prompt_id.");
    }

    const lifecycle: IComfyAdapterLifecycleEvent[] = [];

    const emitLifecycle = (event: IComfyAdapterLifecycleEvent): void => {
      lifecycle.push(event);
      onLifecycleEvent?.(event);
    };

    emitLifecycle(Object.freeze({
      executionId: promptId,
      status: "queued",
      percent: 0,
      message: "Prompt queued in ComfyUI.",
    }));

    return Object.freeze({
      executionId: promptId,
      cancel: async () => {
        await this.options.queueClient.cancelPrompt(promptId);
        emitLifecycle(Object.freeze({
          executionId: promptId,
          status: "cancelled",
          message: "Workflow cancelled.",
        }));
      },
      waitForCompletion: async (): Promise<IComfyAdapterResult> => {
        try {
          const completion = await this.options.queueClient.waitForCompletion(
            promptId,
            (progress) => emitLifecycle(mapComfyProgressToLifecycleEvent(progress)),
          );

          const normalized = this.resultMapper.map({
            completion,
            consumedAssetRefs: request.inputAssetRefs,
          });

          return Object.freeze({
            executionId: promptId,
            status: "completed",
            outputs: normalized.outputs,
            lifecycle: Object.freeze(lifecycle.slice()),
            messages: normalized.messages,
          });
        } catch (error: unknown) {
          const normalizedError = mapComfyError(error);
          return Object.freeze({
            executionId: promptId,
            status: normalizedError.code === "execution-cancelled" ? "cancelled" : "failed",
            outputs: [],
            lifecycle: Object.freeze(lifecycle.slice()),
            error: normalizedError,
            messages: [normalizedError.message],
          });
        }
      },
    });
  }
}

export class ComfyWorkflowExecutor implements IWorkflowExecutor {
  private readonly executionService: ComfyExecutionService;

  constructor(private readonly options: IComfyWorkflowExecutorOptions) {
    this.executionService = new ComfyExecutionService(options.adapter, {
      toAdapterRequest: (input) => this.toAdapterRequest(input),
      toWorkflowAssets: (input, result) => this.mapAssetsFromAdapterResult(input.workflow, result),
    });
  }

  public async startExecution(input: IWorkflowExecutionInput): Promise<IWorkflowExecutionHandle> {
    if (!this.canExecute(input)) {
      throw new Error(`ComfyWorkflowExecutor cannot execute workflow '${input.workflow.id}'.`);
    }

    return this.executionService.startExecution(input);
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void,
  ): Promise<IWorkflowExecutionResult> {
    const handle = await this.startExecution(input);

    let unsubscribe: (() => void) | undefined;
    if (onEvent && typeof handle.subscribe === "function") {
      const maybeUnsubscribe = await handle.subscribe(onEvent);
      unsubscribe = typeof maybeUnsubscribe === "function" ? maybeUnsubscribe : undefined;
    }

    try {
      return await handle.waitForCompletion();
    } finally {
      unsubscribe?.();
    }
  }

  public canExecute(input: IWorkflowExecutionInput): boolean {
    const runtime = typeof input.target?.runtime === "string"
      ? input.target.runtime.toLowerCase()
      : input.workflow.runtimeProfile?.preferredRuntime?.toLowerCase();

    return !runtime || runtime === "comfyui";
  }

  private toAdapterRequest(input: IWorkflowExecutionInput): IComfyAdapterRequest {
    return {
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
    };
  }

  private mapAssetsFromAdapterResult(
    workflow: IWorkflow,
    result: IComfyAdapterResult,
  ): ReadonlyArray<IAsset> {
    return Object.freeze(result.outputs.map((output) => {
      if (output.kind === "text") {
        return this.createTextAsset({
          workflow,
          executionId: result.executionId,
          nodeId: output.nodeId,
          reference: output.reference,
          text: typeof output.metadata?.text === "string" ? output.metadata.text : "",
          consumedAssetIds: output.lineage?.consumedAssetRefs?.map((assetRef) => assetRef.assetId),
        });
      }

      return this.createFileAsset({
        workflow,
        executionId: result.executionId,
        nodeId: output.nodeId,
        kind: output.kind,
        filename: typeof output.metadata?.filename === "string"
          ? output.metadata.filename
          : output.reference,
        subfolder: typeof output.metadata?.subfolder === "string"
          ? output.metadata.subfolder
          : undefined,
        type: typeof output.metadata?.type === "string"
          ? output.metadata.type
          : undefined,
        format: typeof output.metadata?.format === "string"
          ? output.metadata.format
          : undefined,
        consumedAssetIds: output.lineage?.consumedAssetRefs?.map((assetRef) => assetRef.assetId),
      });
    }));
  }

  private createTextAsset(params: {
    readonly workflow: IWorkflow;
    readonly executionId: string;
    readonly nodeId: string;
    readonly reference: string;
    readonly text: string;
    readonly consumedAssetIds?: ReadonlyArray<string>;
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
        tags: ["comfyui", "text-output", ...(params.consumedAssetIds ?? []).map((id) => `input:${id}`)],
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
    readonly consumedAssetIds?: ReadonlyArray<string>;
  }): IAsset {
    const url = this.options.buildViewUrl
      ? this.options.buildViewUrl({
          filename: params.filename,
          subfolder: params.subfolder,
          type: params.type,
        })
      : params.filename;

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
      semanticMetadata: new AssetSemanticMetadata({
        tags: ["comfyui", params.kind, ...(params.consumedAssetIds ?? []).map((id) => `input:${id}`)],
      }),
      relationships: [],
      audit: new AssetAuditInfo({ createdAt: new Date(), updatedAt: new Date() }),
    });
  }
}

function inferContentType(kind: IAsset["kind"], format?: string): string | undefined {
  const normalizedFormat = format?.trim().toLowerCase();

  if (kind === "image") {
    if (normalizedFormat === "png") return "image/png";
    if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") return "image/jpeg";
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
