import type { ComfyWorkflowDto } from "@infrastructure/comfyui/dto/ComfyWorkflowDto";
import { ComfyUiTransportClient } from "../comfyui/ComfyUiTransportClient";
import type { ComfyUiDispatchGateway, ComfyUiDispatchPayload } from "./ComfyUiRunExecutionDispatchAdapter";

export class ComfyUiRunExecutionTransportGateway implements ComfyUiDispatchGateway {
  public constructor(private readonly transport: ComfyUiTransportClient) {}

  public async submitComfyUiDispatch(payload: ComfyUiDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> {
    const comfyRequest = resolveComfyRequest(payload);
    const accepted = await this.transport.submitPrompt({
      request: comfyRequest,
    });

    return Object.freeze({
      acceptedAt: accepted.acceptedAt,
      backendRunId: accepted.promptId,
      metadata: Object.freeze({
        queueNumber: accepted.queueNumber,
        runtime: "comfyui",
        submissionKind: "comfyui-prompt",
      }),
    });
  }
}

function resolveComfyRequest(payload: ComfyUiDispatchPayload): ComfyWorkflowDto {
  const candidate = payload.inputParameters["comfy.request"];
  if (!candidate || typeof candidate !== "object") {
    throw new Error(
      "ComfyUI dispatch payload is missing the translated request at inputs.parameters['comfy.request'].",
    );
  }

  const prompt = (candidate as { prompt?: unknown }).prompt;
  if (!prompt || typeof prompt !== "object") {
    throw new Error(
      "ComfyUI dispatch payload contains an invalid 'comfy.request.prompt' value.",
    );
  }

  const providedClientId = (candidate as { client_id?: unknown }).client_id;
  const clientId = typeof providedClientId === "string" && providedClientId.trim()
    ? providedClientId.trim()
    : payload.runId;

  return Object.freeze({
    prompt: prompt as ComfyWorkflowDto["prompt"],
    client_id: clientId,
  });
}
