import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  rebindImageSystemWorkflow,
  rehydrateImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  ImageSystemDefinitionAuthoringResult,
  UpdateImageSystemDefinitionRequest,
} from "./ImageSystemDefinitionAuthoringContracts";
import { toImageSystemDefinitionAuthoringResult } from "./ImageSystemDefinitionAuthoringContracts";
import {
  ImageSystemDefinitionAuthoringError,
  ImageSystemDefinitionAuthoringErrorCodes,
} from "./ImageSystemDefinitionAuthoringErrors";
import {
  assertBoundWorkflowVersion,
  assertSystemActionAuthorized,
  assertSystemBindingReferencesWorkflow,
  assertSystemDefinitionReadyForPersistence,
  assertSystemLifecycleTransition,
  assertSystemWorkspaceScope,
} from "./ImageSystemDefinitionAuthoringShared";
import {
  buildMutationContext,
  createBoundaryContext,
} from "./ImageWorkflowDefinitionAuthoringShared";

export class UpdateImageSystemDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: UpdateImageSystemDefinitionRequest): Promise<ImageSystemDefinitionAuthoringResult> {
    const context = createBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      operationKey: request.operationKey,
      occurredAt: request.occurredAt,
      actionPrefix: "image-system-definition.update",
    });

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const systemId = request.systemId.trim();
      if (!systemId) {
        throw new ImageSystemDefinitionAuthoringError(
          ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
          "systemId is required.",
        );
      }

      const existing = await this.ports.systemRepository.findSystemDefinitionById(systemId, {
        workspaceId: context.workspaceId,
        includeArchived: true,
      });
      if (!existing) {
        throw new ImageSystemDefinitionAuthoringError(
          ImageSystemDefinitionAuthoringErrorCodes.notFound,
          `Image system definition '${systemId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      await assertSystemActionAuthorized({
        authorization: this.ports.authorization,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.systemUpdate,
        resourceId: existing.systemId,
        ownerUserId: existing.ownership.ownerUserId,
        visibility: existing.ownership.visibility,
        sharingPolicyId: existing.ownership.sharingPolicyId,
        correlationId: request.correlationId,
        occurredAt: context.occurredAtIso,
      });

      const workflowBindingChanged = Boolean(request.changes.workflowBinding);
      const workflowRebound = workflowBindingChanged
        ? rebindImageSystemWorkflow(existing, {
          workflowBinding: request.changes.workflowBinding ?? existing.workflowBinding,
          actorUserId: context.actorUserId,
          now: context.occurredAt,
        })
        : existing;

      const nextLifecycleState = workflowBindingChanged
        ? ImageSystemLifecycleStates.draft
        : (request.changes.lifecycleState ?? workflowRebound.lifecycleState);

      if (!workflowBindingChanged) {
        assertSystemLifecycleTransition({
          current: existing,
          nextState: nextLifecycleState,
        });
      }

      const updated = rehydrateImageSystemDefinition({
        ...workflowRebound,
        ownership: request.changes.ownership
          ? {
            workspaceId: existing.ownership.workspaceId,
            ownerUserId: request.changes.ownership.ownerUserId,
            visibility: request.changes.ownership.visibility,
            sharingPolicyId: request.changes.ownership.sharingPolicyId,
            sharingPolicyVersion: request.changes.ownership.sharingPolicyVersion,
          }
          : workflowRebound.ownership,
        display: request.changes.display ?? workflowRebound.display,
        inputAssetSelections: request.changes.inputAssetSelections ?? workflowRebound.inputAssetSelections,
        outputTargetBindings: request.changes.outputTargetBindings ?? workflowRebound.outputTargetBindings,
        parameterBaseline: request.changes.parameterBaseline ?? workflowRebound.parameterBaseline,
        lifecycleState: nextLifecycleState,
        runtimeStatus: workflowBindingChanged
          ? ImageSystemRuntimeStatuses.disabled
          : (request.changes.runtimeStatus ?? workflowRebound.runtimeStatus),
        lineage: request.changes.lineage ?? workflowRebound.lineage,
        lastModifiedBy: context.actorUserId,
        updatedAt: context.occurredAt,
      });

      assertSystemWorkspaceScope({
        requestedWorkspaceId: context.workspaceId,
        systemWorkspaceId: updated.ownership.workspaceId,
      });

      const workflow = await this.ports.workflowRepository.findWorkflowDefinitionById(
        updated.workflowBinding.workflowId,
        {
          workspaceId: context.workspaceId,
          includeRetired: false,
        },
      );
      if (!workflow) {
        throw new ImageSystemDefinitionAuthoringError(
          ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
          `Bound workflow '${updated.workflowBinding.workflowId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      assertBoundWorkflowVersion({
        workflow,
        system: updated,
      });
      assertSystemBindingReferencesWorkflow({
        workflow,
        system: updated,
      });

      const readiness = await assertSystemDefinitionReadyForPersistence({
        workspaceId: context.workspaceId,
        workflow,
        system: updated,
        validationService: this.ports.systemValidation,
        compatibilityService: this.ports.compatibility,
      });

      const mutationResult = await this.ports.systemRepository.saveSystemDefinition(
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

      return toImageSystemDefinitionAuthoringResult({
        mutationResult,
        operationKey: context.operationKey,
        occurredAt: context.occurredAtIso,
        readiness: readiness.readiness,
        validation: readiness.validation,
        compatibility: readiness.compatibility,
        structure: readiness.structure,
      });
    });
  }
}
