import {
  ImageWorkflowCategories,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  isImageSystemLifecycleTransitionAllowed,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import type {
  ImageDefinitionValidationResult,
  IImageSystemDefinitionValidationService,
  IImageWorkflowSystemAuthorizationPort,
  IImageWorkflowSystemCompatibilityService,
  ImageWorkflowSystemAuthorizationDecision,
  ImageWorkflowSystemCompatibilityResult,
} from "./ports";
import {
  ImageWorkflowSystemAuthorizationResourceKinds,
  ImageWorkflowSystemPermissionActions,
} from "./ports";
import {
  type ImageSystemDefinitionReadinessSummary,
  type ImageSystemDefinitionStructureSummary,
} from "./ImageSystemDefinitionAuthoringContracts";
import {
  ImageSystemDefinitionAuthoringError,
  ImageSystemDefinitionAuthoringErrorCodes,
} from "./ImageSystemDefinitionAuthoringErrors";
import { ImageWorkflowSystemReadinessValidationService } from "./ImageWorkflowSystemReadinessValidationService";

export async function assertSystemActionAuthorized(input: {
  readonly authorization: IImageWorkflowSystemAuthorizationPort;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: typeof ImageWorkflowSystemPermissionActions[keyof typeof ImageWorkflowSystemPermissionActions];
  readonly resourceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: ImageSystemDefinition["ownership"]["visibility"];
  readonly sharingPolicyId?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}): Promise<ImageWorkflowSystemAuthorizationDecision> {
  const decision = await input.authorization.authorizeImageWorkflowSystemAction({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    action: input.action,
    resource: {
      kind: ImageWorkflowSystemAuthorizationResourceKinds.systemDefinition,
      resourceId: input.resourceId,
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
      sharingPolicyId: input.sharingPolicyId,
    },
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
  });

  if (!decision.allowed) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.unauthorized,
      decision.reason?.trim() || "Actor is not authorized for image system definition authoring.",
      Object.freeze({
        reasonCode: decision.reasonCode,
        evaluatedAt: decision.evaluatedAt,
      }),
    );
  }

  return decision;
}

export function assertSystemWorkspaceScope(input: {
  readonly requestedWorkspaceId: string;
  readonly systemWorkspaceId: string;
}): void {
  if (input.requestedWorkspaceId !== input.systemWorkspaceId) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      "System ownership.workspaceId must match the requested workspace scope.",
      Object.freeze({
        requestedWorkspaceId: input.requestedWorkspaceId,
        systemWorkspaceId: input.systemWorkspaceId,
      }),
    );
  }
}

export function assertSystemLifecycleTransition(input: {
  readonly current: ImageSystemDefinition;
  readonly nextState: ImageSystemDefinition["lifecycleState"];
}): void {
  if (!isImageSystemLifecycleTransitionAllowed(input.current.lifecycleState, input.nextState)) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.lifecycleTransitionDenied,
      `Image system lifecycle cannot transition from '${input.current.lifecycleState}' to '${input.nextState}'.`,
      Object.freeze({
        from: input.current.lifecycleState,
        to: input.nextState,
      }),
    );
  }
}

export function assertBoundWorkflowVersion(input: {
  readonly workflow: ImageWorkflowDefinition;
  readonly system: ImageSystemDefinition;
}): void {
  const { workflow, system } = input;
  if (workflow.category !== ImageWorkflowCategories.imageManipulation) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      `Workflow '${workflow.workflowId}' category '${workflow.category}' is not supported for image system authoring.`,
    );
  }

  if (system.workflowBinding.workflowId !== workflow.workflowId) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      "System workflowBinding.workflowId must match the resolved workflow definition.",
    );
  }
  if (system.workflowBinding.workflowLineageId !== workflow.version.lineageId) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      "System workflowBinding.workflowLineageId must match the resolved workflow lineage.",
    );
  }
  if (system.workflowBinding.workflowVersionTag !== workflow.version.versionTag) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      "System workflowBinding.workflowVersionTag must match the resolved workflow versionTag.",
    );
  }
  if (system.workflowBinding.workflowRevision !== workflow.version.revision) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.invalidRequest,
      "System workflowBinding.workflowRevision must match the resolved workflow revision.",
    );
  }
}

export function assertSystemBindingReferencesWorkflow(input: {
  readonly workflow: ImageWorkflowDefinition;
  readonly system: ImageSystemDefinition;
}): void {
  const readinessService = new ImageWorkflowSystemReadinessValidationService();
  const issues = readinessService.evaluateSystemBindingCompatibility(input);

  if (issues.length > 0) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.incompatible,
      "Image system workflow binding requirements are incompatible with the resolved workflow definition.",
      Object.freeze({
        issues,
      }),
    );
  }
}

export async function assertSystemDefinitionReadyForPersistence(input: {
  readonly workspaceId: string;
  readonly workflow: ImageWorkflowDefinition;
  readonly system: ImageSystemDefinition;
  readonly validationService: IImageSystemDefinitionValidationService;
  readonly compatibilityService: IImageWorkflowSystemCompatibilityService;
}): Promise<{
  readonly readiness: ImageSystemDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly compatibility: ImageWorkflowSystemCompatibilityResult;
  readonly structure: ImageSystemDefinitionStructureSummary;
}> {
  const readinessService = new ImageWorkflowSystemReadinessValidationService();
  const assessment = await readinessService.evaluateSystemAuthoring({
    workspaceId: input.workspaceId,
    workflow: input.workflow,
    system: input.system,
    validationService: input.validationService,
    compatibilityService: input.compatibilityService,
  });

  if (assessment.compatibility.outcome === "incompatible") {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.incompatible,
      "Image system definition is incompatible with the bound workflow definition.",
      Object.freeze({
        issues: assessment.issues,
      }),
    );
  }

  if (assessment.blocking) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.validationFailed,
      "Image system definition failed authoring validation.",
      Object.freeze({
        issues: assessment.issues,
      }),
    );
  }

  return Object.freeze({
    readiness: assessment.readiness,
    validation: assessment.validation,
    compatibility: assessment.compatibility,
    structure: assessment.structure,
  });
}
