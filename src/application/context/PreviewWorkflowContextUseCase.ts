import type { DynamicContextSourceInput } from "./models/ContextAssemblyRequest";
import type { ContextPreviewResult } from "./models/ContextPreview";
import { WorkflowContextService, type IResolveWorkflowContextRequest } from "./WorkflowContextService";
import { createBasePreviewResult, createDeliveryTargets } from "./ContextPreviewSupport";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";

export interface IPreviewWorkflowContextRequest
  extends Omit<IResolveWorkflowContextRequest, "workflow"> {
  readonly workflow: IWorkflow;
  readonly dynamicSources?: ReadonlyArray<DynamicContextSourceInput>;
}

export class PreviewWorkflowContextUseCase {
  public constructor(
    private readonly workflowContextService: WorkflowContextService
  ) {}

  public async execute(request: IPreviewWorkflowContextRequest): Promise<ContextPreviewResult> {
    const resolved = await this.workflowContextService.inspectWorkflowContext(request);

    return createBasePreviewResult({
      target: {
        kind: "workflow",
        id: request.workflow.id,
        label: request.workflow.metadata.name,
      },
      resolved,
      deliveryTargets: createDeliveryTargets({
        kind: "workflow",
        finalPromptText: resolved.inspection.finalPromptText,
        assembledPromptText: resolved.inspection.assembledPromptText,
        toolUsePolicy: resolved.executionContext.toolUsePolicy,
      }),
    });
  }
}

