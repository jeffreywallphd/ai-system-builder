import type {
  ICommonImageNodeContract,
  ICommonImageNodePromptConditioning,
  IImageNodeExecutionRequest,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const ADAPTER_ID = "image.prompt-input";
const ADAPTER_VERSION = "1.0.0";

const PROMPT_INPUT_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: ADAPTER_ID,
    kind: "prompt-input",
    version: ADAPTER_VERSION,
    displayName: "Prompt Input",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    versionedInputs: false,
    deterministicByDefault: true,
  }),
  inputContract: Object.freeze([
    Object.freeze({
      id: "positivePrompt",
      type: "text",
      required: true,
      inspectable: true,
      previewable: true,
      description: "Positive prompt text used to produce conditioning.",
    }),
    Object.freeze({
      id: "negativePrompt",
      type: "text",
      required: false,
      inspectable: true,
      previewable: true,
      description: "Optional negative prompt text for suppression guidance.",
    }),
    Object.freeze({
      id: "model",
      type: "model",
      required: true,
      inspectable: true,
      previewable: false,
      description: "Internal loaded model capability used for prompt encoding.",
    }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({
      id: "promptConditioning",
      type: "conditioning",
      inspectable: true,
      previewable: false,
      versioned: false,
      description: "Internal prompt-conditioning representation for downstream samplers.",
    }),
  ]),
  configContract: Object.freeze({
    version: ADAPTER_VERSION,
    fields: Object.freeze([]),
  }),
  inspection: Object.freeze({
    tags: Object.freeze(["image", "prompt", "conditioning"]),
  }),
});

export class ComfyPromptInputNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = PROMPT_INPUT_NODE_CONTRACT;

  protected resolveComfyClassType(): string {
    return "CLIPTextEncode";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const model = this.requireModelInput(request);
    const positivePrompt = this.requirePrompt(request.inputs.positivePrompt, "positivePrompt");

    return Object.freeze({
      text: positivePrompt,
      clip: model.runtimeBindingRef ?? model.modelRef,
    });
  }

  protected mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
  ) {
    const positivePrompt = this.requirePrompt(request.inputs.positivePrompt, "positivePrompt");
    const negativePrompt = this.optionalPrompt(request.inputs.negativePrompt);
    const bindingRef = this.optionalText(request.metadata?.bindingRef);
    const source = this.resolvePromptSource(request.metadata?.promptSource);

    const conditioning: ICommonImageNodePromptConditioning = Object.freeze({
      positivePrompt,
      negativePrompt,
      source,
      bindingRef,
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      metadata: Object.freeze({
        encoded: result.outputs.conditioning !== undefined,
      }),
    });

    return Object.freeze([
      Object.freeze({
        outputId: "promptConditioning",
        value: conditioning,
        inspection: Object.freeze({
          hasPositivePrompt: true,
          hasNegativePrompt: Boolean(negativePrompt),
          promptSource: source,
          bindingRef,
        }),
      }),
    ]);
  }

  public normalizeError(error: unknown, request: IImageNodeExecutionRequest) {
    const message = error instanceof Error ? error.message : "Prompt input node execution failed.";
    const isValidation = message.toLowerCase().includes("prompt") || message.toLowerCase().includes("model");
    return Object.freeze({
      code: isValidation ? "prompt-input-invalid" : "prompt-input-execution-failed",
      message,
      retryable: false,
      category: isValidation ? "validation" : "execution",
      details: Object.freeze({ nodeId: request.nodeId }),
    });
  }

  private requireModelInput(request: IImageNodeExecutionRequest): { modelRef: string; runtimeBindingRef?: string } {
    const value = request.inputs.model;
    if (!value || typeof value !== "object") {
      throw new Error("Prompt input node requires a loaded model capability input.");
    }

    const candidate = value as { modelRef?: unknown; runtimeBindingRef?: unknown };
    if (typeof candidate.modelRef !== "string" || candidate.modelRef.trim().length === 0) {
      throw new Error("Prompt input node model capability is missing modelRef.");
    }

    return {
      modelRef: candidate.modelRef.trim(),
      runtimeBindingRef:
        typeof candidate.runtimeBindingRef === "string" && candidate.runtimeBindingRef.trim().length > 0
          ? candidate.runtimeBindingRef.trim()
          : undefined,
    };
  }

  private requirePrompt(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Prompt input node '${field}' must be a non-empty string.`);
    }
    return value.trim();
  }

  private optionalPrompt(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private optionalText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private resolvePromptSource(
    value: unknown,
  ): ICommonImageNodePromptConditioning["source"] {
    if (value === "workflow-input" || value === "ui" || value === "system") {
      return value;
    }
    return "unspecified";
  }
}
