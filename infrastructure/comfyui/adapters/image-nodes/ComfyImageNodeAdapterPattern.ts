import type {
  ICommonImageNodeContract,
  IImageNodeExecutionError,
  IImageNodeExecutionRequest,
  IImageNodeExecutionResponse,
  IImageNodeInspectionMetadata,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";

export interface IComfyNodeExecutionContext {
  readonly promptId?: string;
  readonly executionId?: string;
  readonly runtimeOptions?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IComfyNodeExecutionPayload {
  readonly classType: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IComfyNodeExecutionResult {
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ICommonImageNodeAdapter {
  readonly contract: ICommonImageNodeContract;

  toComfyPayload(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): IComfyNodeExecutionPayload;

  fromComfyResult(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeExecutionResponse;

  inspect(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeInspectionMetadata;

  normalizeError(
    error: unknown,
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeExecutionError;
}

export abstract class ComfyImageNodeAdapterBase implements ICommonImageNodeAdapter {
  public abstract readonly contract: ICommonImageNodeContract;

  public toComfyPayload(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): IComfyNodeExecutionPayload {
    this.assertRequiredInputs(request);

    return Object.freeze({
      classType: this.resolveComfyClassType(),
      inputs: Object.freeze(this.mapRequestInputs(request, context)),
      metadata: context?.metadata,
    });
  }

  public fromComfyResult(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeExecutionResponse {
    return Object.freeze({
      nodeId: request.nodeId,
      status: "completed",
      outputs: Object.freeze(this.mapResultOutputs(request, result, context)),
      inspection: Object.freeze({
        diagnostics: result.metadata,
      }),
    });
  }

  public inspect(
    _request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeInspectionMetadata {
    return Object.freeze({
      tags: [this.contract.identity.kind, "comfyui-adapter"],
      summary: {
        nodeId: this.contract.identity.id,
        nodeVersion: this.contract.identity.version,
        runtime: "comfyui",
      },
      diagnostics: context?.metadata,
    });
  }

  public normalizeError(
    error: unknown,
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): IImageNodeExecutionError {
    const message = error instanceof Error ? error.message : "Image node execution failed.";
    return Object.freeze({
      code: "image-node-execution-failed",
      message,
      retryable: false,
      category: "execution",
      details: { nodeId: request.nodeId },
    });
  }

  protected abstract resolveComfyClassType(): string;

  protected abstract mapRequestInputs(
    request: IImageNodeExecutionRequest,
    context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>>;

  protected abstract mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
    context?: IComfyNodeExecutionContext,
  ): IImageNodeExecutionResponse["outputs"];

  private assertRequiredInputs(request: IImageNodeExecutionRequest): void {
    const missingInput = this.contract.inputContract.find(
      (input) => input.required && request.inputs[input.id] === undefined,
    );

    if (missingInput) {
      throw new Error(
        `Node '${request.nodeId}' is missing required input '${missingInput.id}'.`,
      );
    }
  }
}
