import type { IToolCapabilityExecutor } from "../ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "./models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "./models/ToolCapabilityInvocationResult";

export class InvokeToolCapabilityUseCase {
  constructor(private readonly executor: IToolCapabilityExecutor) {}

  public async execute(
    request: ToolCapabilityInvocationRequest
  ): Promise<ToolCapabilityInvocationResult> {
    const capabilityId = request.capabilityId.trim();
    const providerId = request.provider.id.trim();
    const providerLabel = request.provider.label.trim();

    if (!capabilityId) {
      throw new Error("Tool capability invocation requires a capabilityId.");
    }

    if (!providerId) {
      throw new Error("Tool capability invocation requires a provider.id.");
    }

    if (!providerLabel) {
      throw new Error("Tool capability invocation requires a provider.label.");
    }

    return this.executor.invoke({
      capabilityId,
      provider: Object.freeze({
        kind: request.provider.kind,
        id: providerId,
        label: providerLabel,
      }),
      source: request.source
        ? Object.freeze({ ...request.source })
        : undefined,
      arguments: request.arguments
        ? Object.freeze({ ...request.arguments })
        : undefined,
      executionId: request.executionId?.trim() || undefined,
      metadata: request.metadata
        ? Object.freeze({ ...request.metadata })
        : undefined,
    });
  }
}
