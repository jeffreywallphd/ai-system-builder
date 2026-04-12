import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";

export class ImageSystemDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageSystemDomainError";
  }
}

export class ImageSystemLifecycleTransitionError extends ImageSystemDomainError {
  constructor(fromState: ImageSystemLifecycleState, toState: ImageSystemLifecycleState, reason?: string) {
    super(
      reason
        ? `Image system lifecycle cannot transition from '${fromState}' to '${toState}': ${reason}.`
        : `Image system lifecycle cannot transition from '${fromState}' to '${toState}'.`,
    );
    this.name = "ImageSystemLifecycleTransitionError";
  }
}

export class ImageSystemRuntimeStatusError extends ImageSystemDomainError {
  constructor(message: string) {
    super(message);
    this.name = "ImageSystemRuntimeStatusError";
  }
}

export const ImageSystemTypes = Object.freeze({
  imageManipulationSystem: "image-manipulation-system",
});

export type ImageSystemType = typeof ImageSystemTypes[keyof typeof ImageSystemTypes] | (string & {});

export const ImageSystemLifecycleStates = Object.freeze({
  draft: "draft",
  ready: "ready",
  archived: "archived",
});

export type ImageSystemLifecycleState =
  typeof ImageSystemLifecycleStates[keyof typeof ImageSystemLifecycleStates];

export const ImageSystemRuntimeStatuses = Object.freeze({
  enabled: "enabled",
  disabled: "disabled",
});

export type ImageSystemRuntimeStatus =
  typeof ImageSystemRuntimeStatuses[keyof typeof ImageSystemRuntimeStatuses];

export interface ImageSystemOwnership {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly visibility: WorkspaceVisibility;
  readonly sharingPolicyId?: string;
  readonly sharingPolicyVersion?: string;
}

export interface ImageSystemDisplayMetadata {
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
}

export interface ImageSystemWorkflowBinding {
  readonly workflowId: string;
  readonly workflowWorkspaceId: string;
  readonly workflowLineageId: string;
  readonly workflowVersionTag: string;
  readonly workflowRevision: number;
  readonly requiredInputIds: ReadonlyArray<string>;
  readonly requiredParameterIds: ReadonlyArray<string>;
  readonly requiredOutputIds: ReadonlyArray<string>;
}

export interface ImageSystemInputAssetSelection {
  readonly inputId: string;
  readonly assetReference: string;
}

export interface ImageSystemOutputTargetBinding {
  readonly outputId: string;
  readonly targetReference: string;
}

export interface ImageSystemParameterBaseline {
  readonly values: Readonly<Record<string, unknown>>;
  readonly profileReferences: ReadonlyArray<string>;
}

export interface ImageSystemLineageMetadata {
  readonly latestRunId?: string;
  readonly latestRunOccurredAt?: string;
  readonly latestOutputAssetIds: ReadonlyArray<string>;
}

export interface ImageSystemDefinition {
  readonly systemId: string;
  readonly systemType: ImageSystemType;
  readonly ownership: ImageSystemOwnership;
  readonly display: ImageSystemDisplayMetadata;
  readonly workflowBinding: ImageSystemWorkflowBinding;
  readonly inputAssetSelections: ReadonlyArray<ImageSystemInputAssetSelection>;
  readonly outputTargetBindings: ReadonlyArray<ImageSystemOutputTargetBinding>;
  readonly parameterBaseline: ImageSystemParameterBaseline;
  readonly lifecycleState: ImageSystemLifecycleState;
  readonly runtimeStatus: ImageSystemRuntimeStatus;
  readonly lineage: ImageSystemLineageMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageSystemReadinessIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export const ImageSystemReadinessIssueCodes = Object.freeze({
  requiredInputSelectionMissing: "required-input-selection-missing",
  requiredOutputBindingMissing: "required-output-binding-missing",
  requiredParametersUnresolved: "required-parameters-unresolved",
});

export const ImageSystemLifecycleTransitions: Readonly<
  Record<ImageSystemLifecycleState, ReadonlyArray<ImageSystemLifecycleState>>
> = Object.freeze({
  [ImageSystemLifecycleStates.draft]: Object.freeze([
    ImageSystemLifecycleStates.ready,
    ImageSystemLifecycleStates.archived,
  ]),
  [ImageSystemLifecycleStates.ready]: Object.freeze([
    ImageSystemLifecycleStates.draft,
    ImageSystemLifecycleStates.archived,
  ]),
  [ImageSystemLifecycleStates.archived]: Object.freeze([
    ImageSystemLifecycleStates.draft,
  ]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageSystemDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const normalized = value instanceof Date ? value.toISOString() : normalizeRequired(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new ImageSystemDomainError(`${field} must be a valid ISO timestamp.`);
  }
  return new Date(normalized).toISOString();
}

function normalizeLogicalReference(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (/^[a-zA-Z]:\\/.test(normalized) || normalized.startsWith("/") || normalized.includes("\\")) {
    throw new ImageSystemDomainError(`${field} must be a logical reference and cannot be a filesystem path.`);
  }
  return normalized;
}

function normalizeVersionTag(value: string): string {
  const normalized = normalizeRequired(value, "Image system workflowVersionTag");
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    throw new ImageSystemDomainError("Image system workflowVersionTag must use semantic version format '<major>.<minor>.<patch>'.");
  }
  return normalized;
}

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ImageSystemDomainError(`${label} '${value}' must be unique.`);
    }
    seen.add(value);
  }
}

function normalizeLifecycleState(value: ImageSystemLifecycleState): ImageSystemLifecycleState {
  if (!Object.values(ImageSystemLifecycleStates).includes(value)) {
    throw new ImageSystemDomainError(`Image system lifecycleState '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeRuntimeStatus(value: ImageSystemRuntimeStatus): ImageSystemRuntimeStatus {
  if (!Object.values(ImageSystemRuntimeStatuses).includes(value)) {
    throw new ImageSystemDomainError(`Image system runtimeStatus '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeOwnership(input: ImageSystemOwnership): ImageSystemOwnership {
  const visibility = normalizeRequired(input.visibility, "Image system visibility") as WorkspaceVisibility;
  if (!Object.values({ private: "private", team: "team", public: "public" } as const).includes(visibility)) {
    throw new ImageSystemDomainError(`Image system visibility '${String(visibility)}' is invalid.`);
  }

  const ownership: ImageSystemOwnership = Object.freeze({
    workspaceId: normalizeRequired(input.workspaceId, "Image system workspaceId"),
    ownerUserId: normalizeOptional(input.ownerUserId),
    visibility,
    sharingPolicyId: normalizeOptional(input.sharingPolicyId),
    sharingPolicyVersion: normalizeOptional(input.sharingPolicyVersion),
  });

  if (ownership.visibility === "private" && !ownership.ownerUserId) {
    throw new ImageSystemDomainError("Private image systems require ownerUserId.");
  }

  return ownership;
}

function normalizeDisplay(metadata: ImageSystemDisplayMetadata): ImageSystemDisplayMetadata {
  const tags = Object.freeze([
    ...new Set((metadata.tags ?? []).map((entry) => normalizeOptional(entry)).filter(Boolean) as string[]),
  ]);

  return Object.freeze({
    title: normalizeRequired(metadata.title, "Image system title"),
    summary: normalizeOptional(metadata.summary),
    tags,
  });
}

function normalizeWorkflowBinding(
  binding: ImageSystemWorkflowBinding,
  systemWorkspaceId: string,
): ImageSystemWorkflowBinding {
  const workflowRevision = binding.workflowRevision;
  if (!Number.isInteger(workflowRevision) || workflowRevision < 0) {
    throw new ImageSystemDomainError("Image system workflowRevision must be a non-negative integer.");
  }

  if (binding.workflowWorkspaceId !== systemWorkspaceId) {
    throw new ImageSystemDomainError("Image system workflow binding workspace must match system workspace scope.");
  }

  const requiredInputIds = Object.freeze([
    ...new Set(binding.requiredInputIds.map((value) => normalizeRequired(value, "Image system requiredInputId"))),
  ]);
  const requiredParameterIds = Object.freeze([
    ...new Set(binding.requiredParameterIds.map((value) => normalizeRequired(value, "Image system requiredParameterId"))),
  ]);
  const requiredOutputIds = Object.freeze([
    ...new Set(binding.requiredOutputIds.map((value) => normalizeRequired(value, "Image system requiredOutputId"))),
  ]);

  return Object.freeze({
    workflowId: normalizeRequired(binding.workflowId, "Image system workflowId"),
    workflowWorkspaceId: normalizeRequired(binding.workflowWorkspaceId, "Image system workflowWorkspaceId"),
    workflowLineageId: normalizeRequired(binding.workflowLineageId, "Image system workflowLineageId"),
    workflowVersionTag: normalizeVersionTag(binding.workflowVersionTag),
    workflowRevision,
    requiredInputIds,
    requiredParameterIds,
    requiredOutputIds,
  });
}

function normalizeInputAssetSelection(selection: ImageSystemInputAssetSelection): ImageSystemInputAssetSelection {
  return Object.freeze({
    inputId: normalizeRequired(selection.inputId, "Image system inputId"),
    assetReference: normalizeLogicalReference(selection.assetReference, "Image system assetReference"),
  });
}

function normalizeOutputTargetBinding(binding: ImageSystemOutputTargetBinding): ImageSystemOutputTargetBinding {
  return Object.freeze({
    outputId: normalizeRequired(binding.outputId, "Image system outputId"),
    targetReference: normalizeLogicalReference(binding.targetReference, "Image system targetReference"),
  });
}

function normalizeParameterBaseline(input: ImageSystemParameterBaseline | undefined): ImageSystemParameterBaseline {
  const values = Object.fromEntries(
    Object.entries(input?.values ?? {}).map(([key, value]) => [normalizeRequired(key, "Image system parameterId"), value]),
  );
  const profileReferences = Object.freeze([
    ...new Set((input?.profileReferences ?? []).map((reference) => normalizeLogicalReference(reference, "Image system profileReference"))),
  ]);

  return Object.freeze({
    values: Object.freeze(values),
    profileReferences,
  });
}

function normalizeLineage(input: ImageSystemLineageMetadata | undefined): ImageSystemLineageMetadata {
  const latestRunId = normalizeOptional(input?.latestRunId);
  const latestRunOccurredAt = input?.latestRunOccurredAt
    ? normalizeIsoTimestamp(input.latestRunOccurredAt, "Image system latestRunOccurredAt")
    : undefined;
  const latestOutputAssetIds = Object.freeze([
    ...new Set((input?.latestOutputAssetIds ?? []).map((value) => normalizeRequired(value, "Image system latestOutputAssetId"))),
  ]);

  if (latestRunOccurredAt && !latestRunId) {
    throw new ImageSystemDomainError("Image system latestRunOccurredAt requires latestRunId.");
  }

  return Object.freeze({
    latestRunId,
    latestRunOccurredAt,
    latestOutputAssetIds,
  });
}

function assertTimestampOrder(createdAt: string, updatedAt: string): void {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new ImageSystemDomainError("Image system updatedAt cannot be earlier than createdAt.");
  }
}

function assertCrossReferenceIntegrity(system: {
  readonly workflowBinding: ImageSystemWorkflowBinding;
  readonly inputAssetSelections: ReadonlyArray<ImageSystemInputAssetSelection>;
  readonly outputTargetBindings: ReadonlyArray<ImageSystemOutputTargetBinding>;
}): void {
  const requiredInputIds = new Set(system.workflowBinding.requiredInputIds);
  for (const selection of system.inputAssetSelections) {
    if (requiredInputIds.size > 0 && !requiredInputIds.has(selection.inputId)) {
      throw new ImageSystemDomainError(
        `Image system input selection '${selection.inputId}' is not declared in bound workflow requiredInputIds.`,
      );
    }
  }

  const requiredOutputIds = new Set(system.workflowBinding.requiredOutputIds);
  for (const binding of system.outputTargetBindings) {
    if (requiredOutputIds.size > 0 && !requiredOutputIds.has(binding.outputId)) {
      throw new ImageSystemDomainError(
        `Image system output target '${binding.outputId}' is not declared in bound workflow requiredOutputIds.`,
      );
    }
  }
}

function assertLifecycleRuntimeCompatibility(
  lifecycleState: ImageSystemLifecycleState,
  runtimeStatus: ImageSystemRuntimeStatus,
): void {
  if (runtimeStatus === ImageSystemRuntimeStatuses.enabled && lifecycleState !== ImageSystemLifecycleStates.ready) {
    throw new ImageSystemRuntimeStatusError("Only ready image systems can be enabled.");
  }
  if (lifecycleState === ImageSystemLifecycleStates.archived && runtimeStatus !== ImageSystemRuntimeStatuses.disabled) {
    throw new ImageSystemRuntimeStatusError("Archived image systems must be disabled.");
  }
}

function normalizeImageSystemDefinition(input: {
  readonly systemId: string;
  readonly systemType: ImageSystemType;
  readonly ownership: ImageSystemOwnership;
  readonly display: ImageSystemDisplayMetadata;
  readonly workflowBinding: ImageSystemWorkflowBinding;
  readonly inputAssetSelections: ReadonlyArray<ImageSystemInputAssetSelection>;
  readonly outputTargetBindings: ReadonlyArray<ImageSystemOutputTargetBinding>;
  readonly parameterBaseline: ImageSystemParameterBaseline;
  readonly lifecycleState: ImageSystemLifecycleState;
  readonly runtimeStatus: ImageSystemRuntimeStatus;
  readonly lineage: ImageSystemLineageMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}): ImageSystemDefinition {
  const ownership = normalizeOwnership(input.ownership);
  const workflowBinding = normalizeWorkflowBinding(input.workflowBinding, ownership.workspaceId);

  const inputAssetSelections = Object.freeze(input.inputAssetSelections.map((entry) => normalizeInputAssetSelection(entry)));
  const outputTargetBindings = Object.freeze(input.outputTargetBindings.map((entry) => normalizeOutputTargetBinding(entry)));

  assertUnique(inputAssetSelections.map((entry) => entry.inputId), "Image system inputId");
  assertUnique(outputTargetBindings.map((entry) => entry.outputId), "Image system outputId");

  const definition: ImageSystemDefinition = Object.freeze({
    systemId: normalizeRequired(input.systemId, "Image system systemId"),
    systemType: normalizeRequired(input.systemType, "Image system systemType"),
    ownership,
    display: normalizeDisplay(input.display),
    workflowBinding,
    inputAssetSelections,
    outputTargetBindings,
    parameterBaseline: normalizeParameterBaseline(input.parameterBaseline),
    lifecycleState: normalizeLifecycleState(input.lifecycleState),
    runtimeStatus: normalizeRuntimeStatus(input.runtimeStatus),
    lineage: normalizeLineage(input.lineage),
    createdBy: normalizeRequired(input.createdBy, "Image system createdBy"),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy, "Image system lastModifiedBy"),
    createdAt: normalizeIsoTimestamp(input.createdAt, "Image system createdAt"),
    updatedAt: normalizeIsoTimestamp(input.updatedAt, "Image system updatedAt"),
  });

  assertTimestampOrder(definition.createdAt, definition.updatedAt);
  assertCrossReferenceIntegrity(definition);
  assertLifecycleRuntimeCompatibility(definition.lifecycleState, definition.runtimeStatus);

  return definition;
}

export function evaluateImageSystemReadiness(
  system: ImageSystemDefinition,
): ReadonlyArray<ImageSystemReadinessIssue> {
  const issues: ImageSystemReadinessIssue[] = [];

  const selectedInputIds = new Set(system.inputAssetSelections.map((entry) => entry.inputId));
  for (const requiredInputId of system.workflowBinding.requiredInputIds) {
    if (!selectedInputIds.has(requiredInputId)) {
      issues.push(Object.freeze({
        code: ImageSystemReadinessIssueCodes.requiredInputSelectionMissing,
        path: `inputAssetSelections.${requiredInputId}`,
        message: `Required workflow input '${requiredInputId}' must have a selected asset reference.`,
      }));
    }
  }

  const outputTargetIds = new Set(system.outputTargetBindings.map((entry) => entry.outputId));
  for (const requiredOutputId of system.workflowBinding.requiredOutputIds) {
    if (!outputTargetIds.has(requiredOutputId)) {
      issues.push(Object.freeze({
        code: ImageSystemReadinessIssueCodes.requiredOutputBindingMissing,
        path: `outputTargetBindings.${requiredOutputId}`,
        message: `Required workflow output '${requiredOutputId}' must have a target binding.`,
      }));
    }
  }

  const parameterKeys = new Set(Object.keys(system.parameterBaseline.values));
  const unresolvedParameterIds = system.workflowBinding.requiredParameterIds.filter((parameterId) => !parameterKeys.has(parameterId));
  if (unresolvedParameterIds.length > 0 && system.parameterBaseline.profileReferences.length === 0) {
    issues.push(Object.freeze({
      code: ImageSystemReadinessIssueCodes.requiredParametersUnresolved,
      path: "parameterBaseline",
      message: "Required workflow parameters must be set directly in parameterBaseline.values or resolved by profileReferences.",
    }));
  }

  return Object.freeze(issues);
}

export function isImageSystemRunnable(system: ImageSystemDefinition): boolean {
  return system.lifecycleState === ImageSystemLifecycleStates.ready
    && system.runtimeStatus === ImageSystemRuntimeStatuses.enabled
    && evaluateImageSystemReadiness(system).length === 0;
}

export function isImageSystemLifecycleTransitionAllowed(
  fromState: ImageSystemLifecycleState,
  toState: ImageSystemLifecycleState,
): boolean {
  if (fromState === toState) {
    return true;
  }
  return ImageSystemLifecycleTransitions[fromState].includes(toState);
}

export function createImageSystemDefinition(input: {
  readonly systemId: string;
  readonly systemType?: ImageSystemType;
  readonly ownership: ImageSystemOwnership;
  readonly display: ImageSystemDisplayMetadata;
  readonly workflowBinding: ImageSystemWorkflowBinding;
  readonly inputAssetSelections?: ReadonlyArray<ImageSystemInputAssetSelection>;
  readonly outputTargetBindings?: ReadonlyArray<ImageSystemOutputTargetBinding>;
  readonly parameterBaseline?: ImageSystemParameterBaseline;
  readonly lifecycleState?: ImageSystemLifecycleState;
  readonly runtimeStatus?: ImageSystemRuntimeStatus;
  readonly lineage?: ImageSystemLineageMetadata;
  readonly createdBy: string;
  readonly now?: Date;
}): ImageSystemDefinition {
  const now = input.now ?? new Date();

  const definition = normalizeImageSystemDefinition({
    systemId: input.systemId,
    systemType: input.systemType ?? ImageSystemTypes.imageManipulationSystem,
    ownership: input.ownership,
    display: input.display,
    workflowBinding: input.workflowBinding,
    inputAssetSelections: input.inputAssetSelections ?? [],
    outputTargetBindings: input.outputTargetBindings ?? [],
    parameterBaseline: input.parameterBaseline ?? { values: {}, profileReferences: [] },
    lifecycleState: input.lifecycleState ?? ImageSystemLifecycleStates.draft,
    runtimeStatus: input.runtimeStatus ?? ImageSystemRuntimeStatuses.disabled,
    lineage: input.lineage ?? { latestOutputAssetIds: [] },
    createdBy: input.createdBy,
    lastModifiedBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  if (definition.lifecycleState === ImageSystemLifecycleStates.ready && evaluateImageSystemReadiness(definition).length > 0) {
    throw new ImageSystemDomainError("Ready image systems must satisfy readiness requirements.");
  }

  return definition;
}

export function rehydrateImageSystemDefinition(input: ImageSystemDefinition): ImageSystemDefinition {
  const definition = normalizeImageSystemDefinition({
    ...input,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (definition.lifecycleState === ImageSystemLifecycleStates.ready && evaluateImageSystemReadiness(definition).length > 0) {
    throw new ImageSystemDomainError("Ready image systems must satisfy readiness requirements.");
  }

  return definition;
}

export function transitionImageSystemLifecycle(
  system: ImageSystemDefinition,
  input: {
    readonly targetState: ImageSystemLifecycleState;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageSystemDefinition {
  const targetState = normalizeLifecycleState(input.targetState);
  if (!isImageSystemLifecycleTransitionAllowed(system.lifecycleState, targetState)) {
    throw new ImageSystemLifecycleTransitionError(system.lifecycleState, targetState);
  }

  if (targetState === system.lifecycleState) {
    return system;
  }

  const nextRuntimeStatus = targetState === ImageSystemLifecycleStates.archived
    ? ImageSystemRuntimeStatuses.disabled
    : system.runtimeStatus;

  const candidate = normalizeImageSystemDefinition({
    ...system,
    lifecycleState: targetState,
    runtimeStatus: nextRuntimeStatus,
    lastModifiedBy: input.actorUserId,
    updatedAt: input.now ?? new Date(),
  });

  if (targetState === ImageSystemLifecycleStates.ready && evaluateImageSystemReadiness(candidate).length > 0) {
    throw new ImageSystemLifecycleTransitionError(
      system.lifecycleState,
      targetState,
      "system configuration is not runnable",
    );
  }

  return candidate;
}

export function setImageSystemRuntimeStatus(
  system: ImageSystemDefinition,
  input: {
    readonly runtimeStatus: ImageSystemRuntimeStatus;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageSystemDefinition {
  const runtimeStatus = normalizeRuntimeStatus(input.runtimeStatus);
  if (runtimeStatus === system.runtimeStatus) {
    return system;
  }

  if (runtimeStatus === ImageSystemRuntimeStatuses.enabled && evaluateImageSystemReadiness(system).length > 0) {
    throw new ImageSystemRuntimeStatusError("Only runnable image systems can be enabled.");
  }

  return normalizeImageSystemDefinition({
    ...system,
    runtimeStatus,
    lastModifiedBy: input.actorUserId,
    updatedAt: input.now ?? new Date(),
  });
}

export function rebindImageSystemWorkflow(
  system: ImageSystemDefinition,
  input: {
    readonly workflowBinding: ImageSystemWorkflowBinding;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageSystemDefinition {
  return normalizeImageSystemDefinition({
    ...system,
    workflowBinding: input.workflowBinding,
    lifecycleState: ImageSystemLifecycleStates.draft,
    runtimeStatus: ImageSystemRuntimeStatuses.disabled,
    lastModifiedBy: input.actorUserId,
    updatedAt: input.now ?? new Date(),
  });
}
