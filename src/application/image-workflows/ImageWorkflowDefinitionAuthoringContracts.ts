import type {
  ImageWorkflowCompletenessIssue,
  ImageWorkflowDefinition,
  ImageWorkflowDisplayMetadata,
  ImageWorkflowInputBindingRule,
  ImageWorkflowInputSlot,
  ImageWorkflowLifecycleState,
  ImageWorkflowOutputBindingRule,
  ImageWorkflowOutputExpectation,
  ImageWorkflowOwnership,
  ImageWorkflowParameterSpecification,
  ImageWorkflowVersionMetadata,
  ImageWorkflowBackendTranslationReference,
  ImageWorkflowActivationStatus,
} from "@domain/image-workflows/ImageWorkflowDomain";
import type {
  ImageDefinitionValidationResult,
  ImageWorkflowSystemMutationResult,
} from "./ports";

export const ImageWorkflowDefinitionReadinessStates = Object.freeze({
  definitionReady: "definition-ready",
  definitionIncomplete: "definition-incomplete",
});

export type ImageWorkflowDefinitionReadinessState =
  typeof ImageWorkflowDefinitionReadinessStates[keyof typeof ImageWorkflowDefinitionReadinessStates];

export interface ImageWorkflowDefinitionReadinessSummary {
  readonly state: ImageWorkflowDefinitionReadinessState;
  readonly ready: boolean;
  readonly evaluatedAt: string;
  readonly completenessIssues: ReadonlyArray<ImageWorkflowCompletenessIssue>;
}

export interface ImageWorkflowDefinitionStructureSummary {
  readonly inputSlots: {
    readonly total: number;
    readonly required: number;
  };
  readonly parameters: {
    readonly total: number;
    readonly required: number;
  };
  readonly outputExpectations: {
    readonly total: number;
    readonly required: number;
  };
  readonly bindings: {
    readonly input: number;
    readonly output: number;
  };
  readonly backendTranslation: {
    readonly translatorId: string;
    readonly templateId: string;
    readonly contractVersion: string;
    readonly inputBindings: number;
    readonly parameterBindings: number;
    readonly outputBindings: number;
  };
}

export interface ImageWorkflowDefinitionAuthoringResult {
  readonly workflow: ImageWorkflowDefinition;
  readonly mutation: {
    readonly changed: boolean;
    readonly wasReplay: boolean;
    readonly operationKey: string;
    readonly occurredAt: string;
  };
  readonly readiness: ImageWorkflowDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly structure: ImageWorkflowDefinitionStructureSummary;
}

export interface CreateImageWorkflowDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly operationKey?: string;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly workflow: {
    readonly workflowId: string;
    readonly workflowType?: string;
    readonly category?: string;
    readonly operationKind: string;
    readonly ownership: ImageWorkflowOwnership;
    readonly display: ImageWorkflowDisplayMetadata;
    readonly version: ImageWorkflowVersionMetadata;
    readonly lifecycleState?: ImageWorkflowLifecycleState;
    readonly activationStatus?: ImageWorkflowActivationStatus;
    readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlot>;
    readonly inputBindings?: ReadonlyArray<ImageWorkflowInputBindingRule>;
    readonly parameterSpecifications?: ReadonlyArray<ImageWorkflowParameterSpecification>;
    readonly outputExpectations: ReadonlyArray<ImageWorkflowOutputExpectation>;
    readonly outputBindings?: ReadonlyArray<ImageWorkflowOutputBindingRule>;
    readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  };
  readonly expectedRevision?: number;
}

export interface UpdateImageWorkflowDefinitionRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly workflowId: string;
  readonly operationKey?: string;
  readonly occurredAt?: Date | string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
  readonly changes: {
    readonly display?: ImageWorkflowDisplayMetadata;
    readonly ownership?: Omit<ImageWorkflowOwnership, "workspaceId">;
    readonly lifecycleState?: ImageWorkflowLifecycleState;
    readonly activationStatus?: ImageWorkflowActivationStatus;
    readonly inputSlots?: ReadonlyArray<ImageWorkflowInputSlot>;
    readonly inputBindings?: ReadonlyArray<ImageWorkflowInputBindingRule>;
    readonly parameterSpecifications?: ReadonlyArray<ImageWorkflowParameterSpecification>;
    readonly outputExpectations?: ReadonlyArray<ImageWorkflowOutputExpectation>;
    readonly outputBindings?: ReadonlyArray<ImageWorkflowOutputBindingRule>;
    readonly backendTranslation?: ImageWorkflowBackendTranslationReference;
  };
}

export function toImageWorkflowDefinitionAuthoringResult(
  input: {
    readonly mutationResult: ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>;
    readonly operationKey: string;
    readonly occurredAt: string;
    readonly readiness: ImageWorkflowDefinitionReadinessSummary;
    readonly validation: ImageDefinitionValidationResult;
    readonly structure: ImageWorkflowDefinitionStructureSummary;
  },
): ImageWorkflowDefinitionAuthoringResult {
  return Object.freeze({
    workflow: input.mutationResult.record,
    mutation: Object.freeze({
      changed: input.mutationResult.changed,
      wasReplay: input.mutationResult.wasReplay,
      operationKey: input.operationKey,
      occurredAt: input.occurredAt,
    }),
    readiness: input.readiness,
    validation: input.validation,
    structure: input.structure,
  });
}
