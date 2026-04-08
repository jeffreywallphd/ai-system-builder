import {
  ImageWorkflowCategories,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  evaluateImageSystemReadiness,
  isImageSystemLifecycleTransitionAllowed,
  isImageSystemRunnable,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import type {
  ImageDefinitionValidationIssue,
  ImageDefinitionValidationResult,
  IImageSystemDefinitionValidationService,
  IImageWorkflowSystemAuthorizationPort,
  IImageWorkflowSystemCompatibilityService,
  ImageWorkflowSystemAuthorizationDecision,
  ImageWorkflowSystemCompatibilityResult,
} from "./ports";
import {
  ImageWorkflowCompatibilityOutcomes,
  ImageWorkflowSystemAuthorizationResourceKinds,
  ImageWorkflowSystemPermissionActions,
} from "./ports";
import {
  ImageSystemDefinitionReadinessStates,
  type ImageSystemDefinitionReadinessSummary,
  type ImageSystemDefinitionStructureSummary,
} from "./ImageSystemDefinitionAuthoringContracts";
import {
  ImageSystemDefinitionAuthoringError,
  ImageSystemDefinitionAuthoringErrorCodes,
} from "./ImageSystemDefinitionAuthoringErrors";

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
  const { workflow, system } = input;
  const workflowInputIds = new Set(workflow.inputSlots.map((entry) => entry.inputId));
  const workflowParameterIds = new Set(workflow.parameterSpecifications.map((entry) => entry.parameterId));
  const workflowOutputIds = new Set(workflow.outputExpectations.map((entry) => entry.outputId));

  const issues: ImageDefinitionValidationIssue[] = [];

  for (const requiredInputId of system.workflowBinding.requiredInputIds) {
    if (!workflowInputIds.has(requiredInputId)) {
      issues.push(Object.freeze({
        code: "required-input-not-declared-by-workflow",
        path: `workflowBinding.requiredInputIds.${requiredInputId}`,
        message: `Required input '${requiredInputId}' is not declared by workflow '${workflow.workflowId}'.`,
        severity: "error",
      }));
    }
  }

  for (const requiredParameterId of system.workflowBinding.requiredParameterIds) {
    if (!workflowParameterIds.has(requiredParameterId)) {
      issues.push(Object.freeze({
        code: "required-parameter-not-declared-by-workflow",
        path: `workflowBinding.requiredParameterIds.${requiredParameterId}`,
        message: `Required parameter '${requiredParameterId}' is not declared by workflow '${workflow.workflowId}'.`,
        severity: "error",
      }));
    }
  }

  for (const requiredOutputId of system.workflowBinding.requiredOutputIds) {
    if (!workflowOutputIds.has(requiredOutputId)) {
      issues.push(Object.freeze({
        code: "required-output-not-declared-by-workflow",
        path: `workflowBinding.requiredOutputIds.${requiredOutputId}`,
        message: `Required output '${requiredOutputId}' is not declared by workflow '${workflow.workflowId}'.`,
        severity: "error",
      }));
    }
  }

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
  const readinessIssues = evaluateImageSystemReadiness(input.system);
  const readiness = createReadinessSummary(input.system, readinessIssues, new Date().toISOString());

  const compatibility = await input.compatibilityService.evaluateSystemWorkflowCompatibility({
    workspaceId: input.workspaceId,
    workflow: input.workflow,
    system: input.system,
    mode: "strict",
  });

  if (compatibility.outcome === ImageWorkflowCompatibilityOutcomes.incompatible) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.incompatible,
      "Image system definition is incompatible with the bound workflow definition.",
      Object.freeze({
        issues: compatibility.issues,
      }),
    );
  }

  const validationMode = input.system.runtimeStatus === ImageSystemRuntimeStatuses.enabled
    ? "runtime"
    : input.system.lifecycleState === ImageSystemLifecycleStates.ready
    ? "ready"
    : "authoring";

  const validation = await input.validationService.validateSystemDefinition({
    workspaceId: input.workspaceId,
    system: input.system,
    mode: validationMode,
  });

  if (!validation.valid || hasErrorSeverity(validation.issues)) {
    throw new ImageSystemDefinitionAuthoringError(
      ImageSystemDefinitionAuthoringErrorCodes.validationFailed,
      "Image system definition failed authoring validation.",
      Object.freeze({
        issues: validation.issues,
      }),
    );
  }

  return Object.freeze({
    readiness,
    validation,
    compatibility,
    structure: buildStructureSummary(input.system),
  });
}

function hasErrorSeverity(issues: ReadonlyArray<ImageDefinitionValidationIssue>): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function createReadinessSummary(
  system: ImageSystemDefinition,
  issues: ReturnType<typeof evaluateImageSystemReadiness>,
  occurredAt: string,
): ImageSystemDefinitionReadinessSummary {
  if (isImageSystemRunnable(system)) {
    return Object.freeze({
      state: ImageSystemDefinitionReadinessStates.configurationRunnable,
      ready: true,
      runnable: true,
      evaluatedAt: occurredAt,
      issues,
    });
  }

  if (issues.length === 0) {
    return Object.freeze({
      state: ImageSystemDefinitionReadinessStates.configurationReady,
      ready: true,
      runnable: false,
      evaluatedAt: occurredAt,
      issues,
    });
  }

  return Object.freeze({
    state: ImageSystemDefinitionReadinessStates.configurationIncomplete,
    ready: false,
    runnable: false,
    evaluatedAt: occurredAt,
    issues,
  });
}

function buildStructureSummary(system: ImageSystemDefinition): ImageSystemDefinitionStructureSummary {
  return Object.freeze({
    workflowBinding: Object.freeze({
      workflowId: system.workflowBinding.workflowId,
      workflowLineageId: system.workflowBinding.workflowLineageId,
      workflowVersionTag: system.workflowBinding.workflowVersionTag,
      workflowRevision: system.workflowBinding.workflowRevision,
    }),
    requirements: Object.freeze({
      requiredInputs: system.workflowBinding.requiredInputIds.length,
      requiredParameters: system.workflowBinding.requiredParameterIds.length,
      requiredOutputs: system.workflowBinding.requiredOutputIds.length,
    }),
    configured: Object.freeze({
      selectedInputs: system.inputAssetSelections.length,
      outputTargets: system.outputTargetBindings.length,
      parameterValues: Object.keys(system.parameterBaseline.values).length,
      parameterProfiles: system.parameterBaseline.profileReferences.length,
    }),
  });
}
