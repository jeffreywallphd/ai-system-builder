import type { IToolCapabilityExecutor } from "@application/ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "@application/tools/models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "@application/tools/models/ToolCapabilityInvocationResult";

export type LocalToolCapabilityHandler = (
  request: ToolCapabilityInvocationRequest
) => Promise<ToolCapabilityInvocationResult>;

export class StaticLocalToolCapabilityExecutor implements IToolCapabilityExecutor {
  constructor(
    private readonly handlers: Readonly<Record<string, LocalToolCapabilityHandler>>
  ) {}

  public async invoke(
    request: ToolCapabilityInvocationRequest
  ): Promise<ToolCapabilityInvocationResult> {
    const handler =
      this.handlers[request.capabilityId] ??
      (request.source?.localToolName ? this.handlers[request.source.localToolName] : undefined);

    if (!handler) {
      throw new Error(`No local tool capability handler is registered for '${request.capabilityId}'.`);
    }

    return handler(request);
  }
}

