import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  GetImageSystemDefinitionRequest,
  ImageSystemDefinitionDetailResult,
} from "./ImageWorkflowSystemQueryContracts";
import {
  toImageSystemDefinitionReadinessSummary,
  toImageSystemDefinitionStructureSummary,
} from "./ImageWorkflowSystemQueryContracts";
import {
  ImageWorkflowSystemQueryError,
  ImageWorkflowSystemQueryErrorCodes,
} from "./ImageWorkflowSystemQueryErrors";
import {
  authorizeSystemQueryAction,
  createQueryBoundaryContext,
  normalizeRequired,
} from "./ImageWorkflowSystemQueryShared";

export class GetImageSystemDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: GetImageSystemDefinitionRequest): Promise<ImageSystemDefinitionDetailResult> {
    const context = createQueryBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      occurredAt: request.occurredAt,
    });
    const systemId = normalizeRequired(request.systemId, "systemId");

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const system = await this.ports.systemRepository.findSystemDefinitionById(systemId, {
        workspaceId: context.workspaceId,
        includeArchived: request.includeArchived,
      });
      if (!system) {
        throw new ImageWorkflowSystemQueryError(
          ImageWorkflowSystemQueryErrorCodes.notFound,
          `Image system definition '${systemId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      await authorizeSystemQueryAction({
        ports: this.ports,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.systemRead,
        resourceId: system.systemId,
        ownerUserId: system.ownership.ownerUserId,
        visibility: system.ownership.visibility,
        sharingPolicyId: system.ownership.sharingPolicyId,
        occurredAt: context.occurredAtIso,
        correlationId: request.correlationId,
      });

      const readiness = toImageSystemDefinitionReadinessSummary(system, context.occurredAtIso);
      return Object.freeze({
        system,
        readiness,
        structure: toImageSystemDefinitionStructureSummary(system),
      });
    });
  }
}
