import { createImageSystemDefinition } from "@domain/systems/ImageSystemDomain";
import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  CreateImageSystemDefinitionRequest,
  ImageSystemDefinitionAuthoringResult,
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
  assertSystemWorkspaceScope,
} from "./ImageSystemDefinitionAuthoringShared";
import {
  buildMutationContext,
  createBoundaryContext,
} from "./ImageWorkflowDefinitionAuthoringShared";

export class CreateImageSystemDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: CreateImageSystemDefinitionRequest): Promise<ImageSystemDefinitionAuthoringResult> {
    const context = createBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      operationKey: request.operationKey,
      occurredAt: request.occurredAt,
      actionPrefix: "image-system-definition.create",
    });

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const system = createImageSystemDefinition({
        systemId: request.system.systemId,
        systemType: request.system.systemType,
        ownership: request.system.ownership,
        display: request.system.display,
        workflowBinding: request.system.workflowBinding,
        inputAssetSelections: request.system.inputAssetSelections,
        outputTargetBindings: request.system.outputTargetBindings,
        parameterBaseline: request.system.parameterBaseline,
        lifecycleState: request.system.lifecycleState,
        runtimeStatus: request.system.runtimeStatus,
        lineage: request.system.lineage,
        createdBy: context.actorUserId,
        now: context.occurredAt,
      });

      const existing = await this.ports.systemRepository.findSystemDefinitionById(system.systemId, {
        workspaceId: context.workspaceId,
        includeArchived: true,
      });
      if (existing) {
        throw new ImageSystemDefinitionAuthoringError(
          ImageSystemDefinitionAuthoringErrorCodes.conflict,
          `Image system definition '${system.systemId}' already exists in workspace '${context.workspaceId}'.`,
        );
      }

      assertSystemWorkspaceScope({
        requestedWorkspaceId: context.workspaceId,
        systemWorkspaceId: system.ownership.workspaceId,
      });

      await assertSystemActionAuthorized({
        authorization: this.ports.authorization,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.systemCreate,
        resourceId: system.systemId,
        ownerUserId: system.ownership.ownerUserId,
        visibility: system.ownership.visibility,
        sharingPolicyId: system.ownership.sharingPolicyId,
        correlationId: request.correlationId,
        occurredAt: context.occurredAtIso,
      });

      const workflow = await this.ports.workflowRepository.findWorkflowDefinitionById(
        system.workflowBinding.workflowId,
        {
          workspaceId: context.workspaceId,
          includeRetired: false,
        },
      );
      if (!workflow) {
        throw new ImageSystemDefinitionAuthoringError(
          ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
          `Bound workflow '${system.workflowBinding.workflowId}' was not found in workspace '${context.workspaceId}'.`,
        );
      }

      assertBoundWorkflowVersion({
        workflow,
        system,
      });
      assertSystemBindingReferencesWorkflow({
        workflow,
        system,
      });

      const readiness = await assertSystemDefinitionReadyForPersistence({
        workspaceId: context.workspaceId,
        workflow,
        system,
        validationService: this.ports.systemValidation,
        compatibilityService: this.ports.compatibility,
      });

      const mutationResult = await this.ports.systemRepository.createSystemDefinition(
        system,
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
