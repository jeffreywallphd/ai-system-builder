import {
  createImageWorkflowDefinition,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  CreateImageWorkflowDefinitionRequest,
  ImageWorkflowDefinitionAuthoringResult,
} from "./ImageWorkflowDefinitionAuthoringContracts";
import { toImageWorkflowDefinitionAuthoringResult } from "./ImageWorkflowDefinitionAuthoringContracts";
import {
  ImageWorkflowDefinitionAuthoringError,
  ImageWorkflowDefinitionAuthoringErrorCodes,
} from "./ImageWorkflowDefinitionAuthoringErrors";
import {
  assertWorkflowActionAuthorized,
  assertWorkflowCategorySupported,
  assertWorkflowDefinitionReadyForPersistence,
  assertWorkspaceScope,
  buildMutationContext,
  createBoundaryContext,
} from "./ImageWorkflowDefinitionAuthoringShared";

export class CreateImageWorkflowDefinitionUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: CreateImageWorkflowDefinitionRequest): Promise<ImageWorkflowDefinitionAuthoringResult> {
    const context = createBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      operationKey: request.operationKey,
      occurredAt: request.occurredAt,
      actionPrefix: "image-workflow-definition.create",
    });

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      const definition = createImageWorkflowDefinition({
        workflowId: request.workflow.workflowId,
        workflowType: request.workflow.workflowType,
        category: request.workflow.category,
        operationKind: request.workflow.operationKind,
        ownership: request.workflow.ownership,
        display: request.workflow.display,
        version: request.workflow.version,
        lifecycleState: request.workflow.lifecycleState,
        activationStatus: request.workflow.activationStatus,
        inputSlots: request.workflow.inputSlots,
        inputBindings: request.workflow.inputBindings,
        parameterSpecifications: request.workflow.parameterSpecifications,
        outputExpectations: request.workflow.outputExpectations,
        outputBindings: request.workflow.outputBindings,
        backendTranslation: request.workflow.backendTranslation,
        createdBy: context.actorUserId,
        now: context.occurredAt,
      });

      const existing = await this.ports.workflowRepository.findWorkflowDefinitionById(definition.workflowId, {
        workspaceId: context.workspaceId,
        includeRetired: true,
      });
      if (existing) {
        throw new ImageWorkflowDefinitionAuthoringError(
          ImageWorkflowDefinitionAuthoringErrorCodes.conflict,
          `Image workflow definition '${definition.workflowId}' already exists in workspace '${context.workspaceId}'.`,
        );
      }

      assertWorkflowCategorySupported(definition);
      assertWorkspaceScope({
        requestedWorkspaceId: context.workspaceId,
        workflowWorkspaceId: definition.ownership.workspaceId,
      });

      await assertWorkflowActionAuthorized({
        authorization: this.ports.authorization,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.workflowCreate,
        resourceId: definition.workflowId,
        ownerUserId: definition.ownership.ownerUserId,
        visibility: definition.ownership.visibility,
        correlationId: request.correlationId,
        occurredAt: context.occurredAtIso,
      });

      const readiness = await assertWorkflowDefinitionReadyForPersistence({
        workflow: definition,
        workspaceId: context.workspaceId,
        validationService: this.ports.workflowValidation,
      });

      const mutationResult = await this.ports.workflowRepository.createWorkflowDefinition(
        definition,
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

export function isImageWorkflowDefinitionAuthoringResult(
  value: unknown,
): value is ImageWorkflowDefinitionAuthoringResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { readonly workflow?: ImageWorkflowDefinition };
  return Boolean(candidate.workflow && typeof candidate.workflow.workflowId === "string");
}
