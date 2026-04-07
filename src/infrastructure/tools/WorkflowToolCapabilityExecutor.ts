import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "../../application/tools/models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "../../application/tools/models/ToolCapabilityInvocationResult";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";

export class WorkflowToolCapabilityExecutor implements IToolCapabilityExecutor {
  constructor(private readonly runToolUseCase: RunToolUseCase) {}

  public async invoke(
    request: ToolCapabilityInvocationRequest
  ): Promise<ToolCapabilityInvocationResult> {
    const toolId = request.source?.workflowToolId ?? request.source?.workflowId;

    if (!toolId) {
      throw new Error("Workflow capability invocation requires a workflow tool identity.");
    }

    const result = await this.runToolUseCase.execute({
      toolId,
      values: request.arguments ?? {},
    });

    return Object.freeze({
      capabilityId: request.capabilityId,
      executionId: result.executionId,
      status: result.status,
      provider: Object.freeze({ ...request.provider }),
      source: request.source ? Object.freeze({ ...request.source }) : undefined,
      content: Object.freeze(
        result.messages.map((message) => Object.freeze({ type: "message", text: message }))
      ),
      structuredContent: Object.freeze({
        toolId: result.toolId,
        messages: Object.freeze([...result.messages]),
      }),
      metadata: request.metadata ? Object.freeze({ ...request.metadata }) : undefined,
      errorMessage:
        result.status === "failed"
          ? result.messages[result.messages.length - 1]
          : undefined,
    });
  }
}
