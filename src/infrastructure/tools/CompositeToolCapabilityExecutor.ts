import type { IToolCapabilityExecutor } from "@application/ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "@application/tools/models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "@application/tools/models/ToolCapabilityInvocationResult";
import type { ToolCapabilityProviderKind } from "@application/tools/models/ToolCapabilityDescriptor";

export interface ToolCapabilityExecutorBinding {
  readonly providerKind: ToolCapabilityProviderKind;
  readonly providerId: string;
  readonly executor: IToolCapabilityExecutor;
}

export class CompositeToolCapabilityExecutor implements IToolCapabilityExecutor {
  constructor(
    private readonly bindings: ReadonlyArray<ToolCapabilityExecutorBinding>
  ) {}

  public async invoke(
    request: ToolCapabilityInvocationRequest
  ): Promise<ToolCapabilityInvocationResult> {
    const binding = this.bindings.find(
      (entry) =>
        entry.providerKind === request.provider.kind &&
        entry.providerId === request.provider.id
    );

    if (!binding) {
      throw new Error(
        `No tool capability executor is registered for provider '${request.provider.kind}:${request.provider.id}'.`
      );
    }

    return binding.executor.invoke(request);
  }
}

