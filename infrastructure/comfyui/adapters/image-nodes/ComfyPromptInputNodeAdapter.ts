import type {
  ICommonImageNodeContract,
  IImageNodeExecutionRequest,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const PROMPT_INPUT_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: "image.prompt-input",
    kind: "prompt-input",
    version: "1.0.0",
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
      id: "prompt",
      type: "text",
      required: true,
      inspectable: true,
      previewable: true,
      description: "Prompt text used to produce conditioning.",
    }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({
      id: "conditioning",
      type: "conditioning",
      inspectable: true,
      previewable: false,
      versioned: false,
      description: "Conditioning object for downstream samplers.",
    }),
  ]),
  configContract: Object.freeze({
    version: "1.0.0",
    fields: Object.freeze([
      Object.freeze({
        id: "clipSkip",
        type: "number",
        required: false,
        defaultValue: 1,
        description: "Optional CLIP layer skip.",
      }),
    ]),
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
    return Object.freeze({
      text: request.inputs.prompt,
      clip_skip: request.config?.clipSkip,
    });
  }

  protected mapResultOutputs(
    _request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
  ) {
    return Object.freeze([
      Object.freeze({
        outputId: "conditioning",
        value: result.outputs.conditioning,
        inspection: Object.freeze({
          source: "comfyui",
        }),
      }),
    ]);
  }
}
