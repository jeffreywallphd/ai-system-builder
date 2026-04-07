import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import { ExecutionContextToolPolicyService } from "./ExecutionContextToolPolicyService";
import { WorkflowContextService, type IResolveWorkflowContextRequest } from "./WorkflowContextService";
import { createBasePreviewResult, createCapabilityDecision, createDeliveryTargets } from "./ContextPreviewSupport";
import type { ContextPreviewResult } from "./models/ContextPreview";
import { ListToolCapabilitiesUseCase } from "../tools/ListToolCapabilitiesUseCase";

export interface IPreviewAgentContextRequest extends Omit<IResolveWorkflowContextRequest, "workflow"> {
  readonly workflow: IWorkflow;
}

export class PreviewAgentContextUseCase {
  public constructor(
    private readonly workflowContextService: WorkflowContextService,
    private readonly listToolCapabilitiesUseCase: ListToolCapabilitiesUseCase,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService(),
  ) {}

  public async execute(request: IPreviewAgentContextRequest): Promise<ContextPreviewResult> {
    const resolved = await this.workflowContextService.inspectWorkflowContext(request);
    const capabilityCatalog = await this.listToolCapabilitiesUseCase.execute();
    const capabilityDecisions = capabilityCatalog.capabilities.map((capability) => {
      const allowed = this.policyService.isSourceAllowed(
        capability.provider.kind,
        capability.source,
        resolved.executionContext,
      );

      return createCapabilityDecision(
        capability,
        allowed ? "allowed" : "blocked",
        allowed
          ? "Available to the agent under the current context policy."
          : "Blocked by the current execution context tool policy.",
      );
    });

    return createBasePreviewResult({
      target: {
        kind: "agent",
        id: request.workflow.id,
        label: `${request.workflow.metadata.name} agent path`,
        workflowId: request.workflow.id,
        workflowLabel: request.workflow.metadata.name,
      },
      resolved,
      capabilityDecisions,
      deliveryTargets: createDeliveryTargets({
        kind: "agent",
        finalPromptText: resolved.inspection.finalPromptText,
        assembledPromptText: resolved.inspection.assembledPromptText,
        toolUsePolicy: resolved.executionContext.toolUsePolicy,
        capabilityDecisions,
      }),
    });
  }
}

