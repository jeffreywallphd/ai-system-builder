import {
  rehydrateImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  ImageWorkflowDefinitionAuthoringResult,
  UpdateImageWorkflowDefinitionRequest,
} from "./ImageWorkflowDefinitionAuthoringContracts";
import { toImageWorkflowDefinitionAuthoringResult } from "./ImageWorkflowDefinitionAuthoringContracts";
import {
  ImageWorkflowDefinitionAuthoringError,
  ImageWorkflowDefinitionAuthoringErrorCodes,
} from "./ImageWorkflowDefinitionAuthoringErrors";
import {
  assertLifecycleTransition,
  assertWorkflowActionAuthorized,
  assertWorkflowCategorySupported,
  assertWorkflowDefinitionReadyForPersistence,
  assertWorkspaceScope,
  buildMutationContext,
  createBoundaryContext,
} from "./ImageWorkflowDefinitionAuthoringShared";

export class UpdateImageWorkflowDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: UpdateImageWorkflowDefinitionRequest): Promise<ImageWorkflowDefinitionAuthoringResult> {
    const context = createBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      operationKey: request.operationKey,
      occurredAt: request.occurredAt,
      actionPrefix: "image-workflow-definition.update",
    });

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const workflowId = request.workflowId.trim();
      if (!workflowId) {
        throw new ImageWorkflowDefinitionAuthoringError(
          ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest,
          "workflowId is required.",
        );
      }

      const existing = await this.ports.workflowRepository.findWorkflowDefinitionById(workflowId, {
        workspaceId: context.workspaceId,
        includeRetired: true,
      });
      if (!existing) {
        throw new ImageWorkflowDefinitionAuthoringError(
          ImageWorkflowDefinitionAuthoringErrorCodes.notFound,
          `Image workflow definition '${workflowId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      await assertWorkflowActionAuthorized({
        authorization: this.ports.authorization,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.workflowUpdate,
        resourceId: existing.workflowId,
        ownerUserId: existing.ownership.ownerUserId,
        visibility: existing.ownership.visibility,
        correlationId: request.correlationId,
        occurredAt: context.occurredAtIso,
      });

      const nextLifecycleState = request.changes.lifecycleState ?? existing.lifecycleState;
      assertLifecycleTransition({
        current: existing,
        nextState: nextLifecycleState,
      });

      const updated = rehydrateImageWorkflowDefinition({
        ...existing,
        display: request.changes.display ?? existing.display,
        ownership: request.changes.ownership
          ? {
            workspaceId: existing.ownership.workspaceId,
            ownerUserId: request.changes.ownership.ownerUserId,
            visibility: request.changes.ownership.visibility,
          }
          : existing.ownership,
        lifecycleState: nextLifecycleState,
        activationStatus: request.changes.activationStatus ?? existing.activationStatus,
        inputSlots: request.changes.inputSlots ?? existing.inputSlots,
        inputBindings: request.changes.inputBindings ?? existing.inputBindings,
        parameterSpecifications: request.changes.parameterSpecifications ?? existing.parameterSpecifications,
        outputExpectations: request.changes.outputExpectations ?? existing.outputExpectations,
        outputBindings: request.changes.outputBindings ?? existing.outputBindings,
        backendTranslation: request.changes.backendTranslation ?? existing.backendTranslation,
        lastModifiedBy: context.actorUserId,
        updatedAt: context.occurredAt,
      });

      assertWorkflowCategorySupported(updated);
      assertWorkspaceScope({
        requestedWorkspaceId: context.workspaceId,
        workflowWorkspaceId: updated.ownership.workspaceId,
      });

      const readiness = await assertWorkflowDefinitionReadyForPersistence({
        workflow: updated,
        workspaceId: context.workspaceId,
        validationService: this.ports.workflowValidation,
      });

      const mutationResult = await this.ports.workflowRepository.saveWorkflowDefinition(
        updated,
        buildMutationContext({
          operationKey: context.operationKey,
          actorUserId: context.actorUserId,
          occurredAt: context.occurredAt,
          correlationId: request.correlationId,
          reason: request.reason,
          expectedRevision: request.expectedRevision,
        }),
      );

      return toImageWorkflowDefinitionAuthoringResult({
        mutationResult,
        operationKey: context.operationKey,
        occurredAt: context.occurredAtIso,
        readiness: readiness.readiness,
        validation: readiness.validation,
        structure: readiness.structure,
      });
    });
  }
}
