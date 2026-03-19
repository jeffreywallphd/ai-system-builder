import type { IToolCapabilityExecutor } from "../ports/interfaces/IToolCapabilityExecutor";
import {
  cloneToolCapabilityRecord,
  type ToolCapabilitySourceDescriptor,
} from "./models/ToolCapabilityDescriptor";
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

    const source = normalizeSource(request.source);
    if (source?.kind && source.kind !== request.provider.kind) {
      throw new Error("Tool capability invocation source.kind must match provider.kind.");
    }

    return this.executor.invoke({
      capabilityId,
      provider: Object.freeze({
        kind: request.provider.kind,
        id: providerId,
        label: providerLabel,
      }),
      source,
      arguments: cloneToolCapabilityRecord(request.arguments) as ToolCapabilityInvocationRequest["arguments"],
      executionId: request.executionId?.trim() || undefined,
      metadata: cloneToolCapabilityRecord(request.metadata) as ToolCapabilityInvocationRequest["metadata"],
    });
  }
}

function normalizeSource(
  source?: ToolCapabilitySourceDescriptor
): ToolCapabilitySourceDescriptor | undefined {
  if (!source) {
    return undefined;
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(source)
        .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
        .filter(([, value]) => value !== undefined && value !== "")
    ) as ToolCapabilitySourceDescriptor
  );
}
