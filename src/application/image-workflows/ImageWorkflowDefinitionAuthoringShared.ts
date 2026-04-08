import {
  ImageWorkflowCategories,
  ImageWorkflowLifecycleStates,
  evaluateImageWorkflowDefinitionCompleteness,
  isImageWorkflowLifecycleTransitionAllowed,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  createImageWorkflowBindingContract,
  ImageWorkflowBindingContractError,
} from "@shared/contracts/image-workflows/ImageWorkflowBindingContracts";
import type {
  ImageDefinitionValidationIssue,
  ImageDefinitionValidationResult,
  IImageWorkflowDefinitionValidationService,
} from "./ports";
import {
  ImageDefinitionValidationSeverities,
  ImageWorkflowSystemAuthorizationResourceKinds,
  ImageWorkflowSystemPermissionActions,
  type IImageWorkflowSystemAuthorizationPort,
  type ImageWorkflowSystemAuthorizationDecision,
  type ImageWorkflowSystemMutationContext,
} from "./ports";
import {
  ImageWorkflowDefinitionReadinessStates,
  type ImageWorkflowDefinitionReadinessSummary,
  type ImageWorkflowDefinitionStructureSummary,
} from "./ImageWorkflowDefinitionAuthoringContracts";
import {
  ImageWorkflowDefinitionAuthoringError,
  ImageWorkflowDefinitionAuthoringErrorCodes,
} from "./ImageWorkflowDefinitionAuthoringErrors";

interface BuildMutationContextInput {
  readonly operationKey?: string;
  readonly actorUserId: string;
  readonly occurredAt: Date;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
}

export interface BoundaryContext {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly operationKey: string;
  readonly occurredAt: Date;
  readonly occurredAtIso: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest,
      `${field} is required.`,
    );
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createBoundaryContext(input: {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly operationKey?: string;
  readonly occurredAt?: Date | string;
  readonly actionPrefix: string;
}): BoundaryContext {
  const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
  const actorUserId = normalizeRequired(input.actorUserId, "actorUserId");
  const occurredAt = parseTimestamp(input.occurredAt, "occurredAt");
  const operationKey = normalizeOptional(input.operationKey) ?? defaultOperationKey(input.actionPrefix, occurredAt);

  return Object.freeze({
    workspaceId,
    actorUserId,
    operationKey,
    occurredAt,
    occurredAtIso: occurredAt.toISOString(),
  });
}

export function buildMutationContext(input: BuildMutationContextInput): ImageWorkflowSystemMutationContext {
  return Object.freeze({
    operationKey: normalizeRequired(input.operationKey ?? "", "operationKey"),
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    occurredAt: input.occurredAt.toISOString(),
    correlationId: normalizeOptional(input.correlationId),
    reason: normalizeOptional(input.reason),
    expectedRevision: input.expectedRevision,
  });
}

export async function assertWorkflowActionAuthorized(input: {
  readonly authorization: IImageWorkflowSystemAuthorizationPort;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: typeof ImageWorkflowSystemPermissionActions[keyof typeof ImageWorkflowSystemPermissionActions];
  readonly resourceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: ImageWorkflowDefinition["ownership"]["visibility"];
  readonly correlationId?: string;
  readonly occurredAt?: string;
}): Promise<ImageWorkflowSystemAuthorizationDecision> {
  const decision = await input.authorization.authorizeImageWorkflowSystemAction({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    action: input.action,
    resource: {
      kind: ImageWorkflowSystemAuthorizationResourceKinds.workflowDefinition,
      resourceId: input.resourceId,
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
    },
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
  });

  if (!decision.allowed) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.unauthorized,
      decision.reason?.trim() || "Actor is not authorized for image workflow definition authoring.",
      Object.freeze({
        reasonCode: decision.reasonCode,
        evaluatedAt: decision.evaluatedAt,
      }),
    );
  }

  return decision;
}

export async function assertWorkflowDefinitionReadyForPersistence(input: {
  readonly workflow: ImageWorkflowDefinition;
  readonly workspaceId: string;
  readonly validationService: IImageWorkflowDefinitionValidationService;
}): Promise<{
  readonly readiness: ImageWorkflowDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly structure: ImageWorkflowDefinitionStructureSummary;
}> {
  assertBindingContractCompatibility(input.workflow);

  const completenessIssues = evaluateImageWorkflowDefinitionCompleteness(input.workflow);
  const readiness = createReadinessSummary({
    completenessIssues,
    occurredAt: new Date().toISOString(),
  });

  if (!readiness.ready) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.incomplete,
      "Image workflow definition is incomplete and cannot be persisted.",
      Object.freeze({
        completenessIssues,
      }),
    );
  }

  const validation = await input.validationService.validateWorkflowDefinition({
    workspaceId: input.workspaceId,
    workflow: input.workflow,
    mode: input.workflow.lifecycleState === ImageWorkflowLifecycleStates.published ? "publish" : "authoring",
  });

  if (!validation.valid || hasErrorSeverity(validation.issues)) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.validationFailed,
      "Image workflow definition failed authoring validation.",
      Object.freeze({
        issues: validation.issues,
      }),
    );
  }

  return Object.freeze({
    readiness,
    validation,
    structure: buildStructureSummary(input.workflow),
  });
}

export function assertWorkspaceScope(input: {
  readonly requestedWorkspaceId: string;
  readonly workflowWorkspaceId: string;
}): void {
  if (input.requestedWorkspaceId !== input.workflowWorkspaceId) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest,
      "Workflow ownership.workspaceId must match the requested workspace scope.",
      Object.freeze({
        requestedWorkspaceId: input.requestedWorkspaceId,
        workflowWorkspaceId: input.workflowWorkspaceId,
      }),
    );
  }
}

export function assertLifecycleTransition(input: {
  readonly current: ImageWorkflowDefinition;
  readonly nextState: ImageWorkflowDefinition["lifecycleState"];
}): void {
  if (!isImageWorkflowLifecycleTransitionAllowed(input.current.lifecycleState, input.nextState)) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.lifecycleTransitionDenied,
      `Image workflow lifecycle cannot transition from '${input.current.lifecycleState}' to '${input.nextState}'.`,
      Object.freeze({
        from: input.current.lifecycleState,
        to: input.nextState,
      }),
    );
  }
}

export function assertWorkflowCategorySupported(workflow: ImageWorkflowDefinition): void {
  if (workflow.category !== ImageWorkflowCategories.imageManipulation) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest,
      `Image workflow category '${workflow.category}' is not supported for image workflow authoring use cases.`,
    );
  }
}

function hasErrorSeverity(issues: ReadonlyArray<ImageDefinitionValidationIssue>): boolean {
  return issues.some((issue) => issue.severity === ImageDefinitionValidationSeverities.error);
}

function parseTimestamp(value: Date | string | undefined, field: string): Date {
  if (!value) {
    return new Date();
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageWorkflowDefinitionAuthoringError(
      ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest,
      `${field} must be a valid timestamp when provided.`,
    );
  }
  return parsed;
}

function defaultOperationKey(prefix: string, occurredAt: Date): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}:${occurredAt.toISOString()}:${random}`;
}

function assertBindingContractCompatibility(workflow: ImageWorkflowDefinition): void {
  try {
    createImageWorkflowBindingContract({
      workflowId: workflow.workflowId,
      workflowVersionTag: workflow.version.versionTag,
      inputSlots: workflow.inputSlots.map((slot) => Object.freeze({
        slotId: slot.inputId,
        label: slot.label,
        description: slot.description,
        purpose: toInputSlotPurpose(slot.kind),
        required: slot.required,
        cardinality: slot.allowsMultiple ? "many" : "one",
        minimumAssetCount: slot.required ? 1 : 0,
        maximumAssetCount: slot.allowsMultiple ? undefined : 1,
        allowedAssetClasses: slot.acceptedAssetKinds,
        allowedMediaClasses: [],
      })),
      outputSlots: workflow.outputExpectations.map((output) => Object.freeze({
        slotId: output.outputId,
        label: output.label,
        description: output.description,
        purpose: toOutputSlotPurpose(output.kind),
        required: output.required,
        cardinality: output.allowsMultiple ? "many" : "one",
        minimumAssetCount: output.required ? 1 : 0,
        maximumAssetCount: output.allowsMultiple ? undefined : 1,
        emittedAssetClasses: [output.valueType],
        emittedMediaClasses: [],
      })),
    });
  } catch (error) {
    if (error instanceof ImageWorkflowBindingContractError) {
      throw new ImageWorkflowDefinitionAuthoringError(
        ImageWorkflowDefinitionAuthoringErrorCodes.validationFailed,
        error.message,
      );
    }
    throw error;
  }
}

function toInputSlotPurpose(value: ImageWorkflowDefinition["inputSlots"][number]["kind"]): string {
  if (value === "source-image") {
    return "source-image";
  }
  if (value === "mask-image") {
    return "mask-image";
  }
  if (value === "reference-image") {
    return "reference-image";
  }
  return "runtime-value";
}

function toOutputSlotPurpose(value: ImageWorkflowDefinition["outputExpectations"][number]["kind"]): string {
  if (value === "generated-image") {
    return "generated-image";
  }
  if (value === "generated-image-collection") {
    return "generated-image-collection";
  }
  return "metadata";
}

function createReadinessSummary(input: {
  readonly completenessIssues: ReturnType<typeof evaluateImageWorkflowDefinitionCompleteness>;
  readonly occurredAt: string;
}): ImageWorkflowDefinitionReadinessSummary {
  if (input.completenessIssues.length === 0) {
    return Object.freeze({
      state: ImageWorkflowDefinitionReadinessStates.definitionReady,
      ready: true,
      evaluatedAt: input.occurredAt,
      completenessIssues: input.completenessIssues,
    });
  }

  return Object.freeze({
    state: ImageWorkflowDefinitionReadinessStates.definitionIncomplete,
    ready: false,
    evaluatedAt: input.occurredAt,
    completenessIssues: input.completenessIssues,
  });
}

function buildStructureSummary(workflow: ImageWorkflowDefinition): ImageWorkflowDefinitionStructureSummary {
  return Object.freeze({
    inputSlots: Object.freeze({
      total: workflow.inputSlots.length,
      required: workflow.inputSlots.filter((slot) => slot.required).length,
    }),
    parameters: Object.freeze({
      total: workflow.parameterSpecifications.length,
      required: workflow.parameterSpecifications.filter((parameter) => parameter.required).length,
    }),
    outputExpectations: Object.freeze({
      total: workflow.outputExpectations.length,
      required: workflow.outputExpectations.filter((output) => output.required).length,
    }),
    bindings: Object.freeze({
      input: workflow.inputBindings.length,
      output: workflow.outputBindings.length,
    }),
    backendTranslation: Object.freeze({
      translatorId: workflow.backendTranslation.translatorId,
      templateId: workflow.backendTranslation.templateId,
      contractVersion: workflow.backendTranslation.contractVersion,
      inputBindings: workflow.backendTranslation.inputBindings.length,
      parameterBindings: workflow.backendTranslation.parameterBindings.length,
      outputBindings: workflow.backendTranslation.outputBindings.length,
    }),
  });
}
