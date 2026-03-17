import type {
  IModelExecutionRequest,
  IModelExecutionResult,
  IModelExecutor,
} from "../../../application/ports/interfaces/IModelExecutor";

export class ComfyModelExecutor implements IModelExecutor {
  public readonly runtime = "comfyui";

  public canExecute(request: IModelExecutionRequest): boolean {
    return !request.runtime || request.runtime.toLowerCase() === this.runtime;
  }

  public async execute(
    request: IModelExecutionRequest
  ): Promise<IModelExecutionResult> {
    if (!this.canExecute(request)) {
      return {
        status: "failed",
        outputs: {},
        errorMessage: `ComfyModelExecutor cannot execute runtime '${request.runtime}'.`,
      };
    }

    return {
      status: "completed",
      outputs: {
        delegated: true,
        nodeId: request.node.id,
        runtime: this.runtime,
        modelId: request.modelId,
      },
      messages: ["Comfy model execution delegated."],
    };
  }
}
