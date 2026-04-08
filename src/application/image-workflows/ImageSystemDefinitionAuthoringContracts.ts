import type {
  ImageSystemDefinition,
  ImageSystemDisplayMetadata,
  ImageSystemInputAssetSelection,
  ImageSystemLifecycleState,
  ImageSystemLineageMetadata,
  ImageSystemOutputTargetBinding,
  ImageSystemOwnership,
  ImageSystemParameterBaseline,
  ImageSystemReadinessIssue,
  ImageSystemRuntimeStatus,
  ImageSystemType,
  ImageSystemWorkflowBinding,
} from "@domain/systems/ImageSystemDomain";
import type {
  ImageDefinitionValidationResult,
  ImageWorkflowSystemCompatibilityResult,
  ImageWorkflowSystemMutationResult,
} from "./ports";

export const ImageSystemDefinitionReadinessStates = Object.freeze({
  configurationIncomplete: "configuration-incomplete",
  configurationReady: "configuration-ready",
  configurationRunnable: "configuration-runnable",
});

export type ImageSystemDefinitionReadinessState =
  typeof ImageSystemDefinitionReadinessStates[keyof typeof ImageSystemDefinitionReadinessStates];

export interface ImageSystemDefinitionReadinessSummary {
  readonly state: ImageSystemDefinitionReadinessState;
  readonly ready: boolean;
  readonly runnable: boolean;
  readonly evaluatedAt: string;
  readonly issues: ReadonlyArray<ImageSystemReadinessIssue>;
}

export interface ImageSystemDefinitionStructureSummary {
  readonly workflowBinding: {
    readonly workflowId: string;
    readonly workflowLineageId: string;
    readonly workflowVersionTag: string;
    readonly workflowRevision: number;
  };
  readonly requirements: {
    readonly requiredInputs: number;
    readonly requiredParameters: number;
    readonly requiredOutputs: number;
  };
  readonly configured: {
    readonly selectedInputs: number;
    readonly outputTargets: number;
    readonly parameterValues: number;
    readonly parameterProfiles: number;
  };
}

export interface ImageSystemDefinitionAuthoringResult {
  readonly system: ImageSystemDefinition;
  readonly mutation: {
    readonly changed: boolean;
    readonly wasReplay: boolean;
    readonly operationKey: string;
    readonly occurredAt: string;
  };
  readonly readiness: ImageSystemDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly compatibility: ImageWorkflowSystemCompatibilityResult;
  readonly structure: ImageSystemDefinitionStructureSummary;
}

export interface CreateImageSystemDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly operationKey?: string;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
  readonly system: {
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
  };
}

export interface UpdateImageSystemDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly systemId: string;
  readonly operationKey?: string;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
  readonly changes: {
    readonly ownership?: Omit<ImageSystemOwnership, "workspaceId">;
    readonly display?: ImageSystemDisplayMetadata;
    readonly workflowBinding?: ImageSystemWorkflowBinding;
    readonly inputAssetSelections?: ReadonlyArray<ImageSystemInputAssetSelection>;
    readonly outputTargetBindings?: ReadonlyArray<ImageSystemOutputTargetBinding>;
    readonly parameterBaseline?: ImageSystemParameterBaseline;
    readonly lifecycleState?: ImageSystemLifecycleState;
    readonly runtimeStatus?: ImageSystemRuntimeStatus;
    readonly lineage?: ImageSystemLineageMetadata;
  };
}

export function toImageSystemDefinitionAuthoringResult(
  input: {
    readonly mutationResult: ImageWorkflowSystemMutationResult<ImageSystemDefinition>;
    readonly operationKey: string;
    readonly occurredAt: string;
    readonly readiness: ImageSystemDefinitionReadinessSummary;
    readonly validation: ImageDefinitionValidationResult;
    readonly compatibility: ImageWorkflowSystemCompatibilityResult;
    readonly structure: ImageSystemDefinitionStructureSummary;
  },
): ImageSystemDefinitionAuthoringResult {
  return Object.freeze({
    system: input.mutationResult.record,
    mutation: Object.freeze({
      changed: input.mutationResult.changed,
      wasReplay: input.mutationResult.wasReplay,
      operationKey: input.operationKey,
      occurredAt: input.occurredAt,
    }),
    readiness: input.readiness,
    validation: input.validation,
    compatibility: input.compatibility,
    structure: input.structure,
  });
}
