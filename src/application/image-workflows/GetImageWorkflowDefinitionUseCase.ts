import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  GetImageWorkflowDefinitionRequest,
  ImageWorkflowDefinitionDetailResult,
} from "./ImageWorkflowSystemQueryContracts";
import {
  toImageWorkflowDefinitionReadinessSummary,
  toImageWorkflowDefinitionStructureSummary,
} from "./ImageWorkflowSystemQueryContracts";
import {
  ImageWorkflowSystemQueryError,
  ImageWorkflowSystemQueryErrorCodes,
} from "./ImageWorkflowSystemQueryErrors";
import {
  authorizeWorkflowQueryAction,
  createQueryBoundaryContext,
  normalizeRequired,
} from "./ImageWorkflowSystemQueryShared";

export class GetImageWorkflowDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: GetImageWorkflowDefinitionRequest): Promise<ImageWorkflowDefinitionDetailResult> {
    const context = createQueryBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      occurredAt: request.occurredAt,
    });
    const workflowId = normalizeRequired(request.workflowId, "workflowId");

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const workflow = await this.ports.workflowRepository.findWorkflowDefinitionById(workflowId, {
        workspaceId: context.workspaceId,
        includeRetired: request.includeRetired,
      });
      if (!workflow) {
        throw new ImageWorkflowSystemQueryError(
          ImageWorkflowSystemQueryErrorCodes.notFound,
          `Image workflow definition '${workflowId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      await authorizeWorkflowQueryAction({
        ports: this.ports,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.workflowRead,
        resourceId: workflow.workflowId,
        ownerUserId: workflow.ownership.ownerUserId,
        visibility: workflow.ownership.visibility,
        occurredAt: context.occurredAtIso,
        correlationId: request.correlationId,
      });

      const readiness = toImageWorkflowDefinitionReadinessSummary(workflow, context.occurredAtIso);
      return Object.freeze({
        workflow,
        readiness,
        structure: toImageWorkflowDefinitionStructureSummary(workflow),
      });
    });
  }
}
