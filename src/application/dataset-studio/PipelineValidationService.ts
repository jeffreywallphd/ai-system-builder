import {
  validatePipelineDefinition,
  type PipelineDefinition,
} from "@domain/dataset-studio/PipelineDefinitionDomain";
import {
  createPipelineStageInstance,
  type PipelineStageId,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import {
  buildPipelineGraph,
  type PipelineGraphTransition,
} from "./PipelineGraphConstructionService";
import type { StageCompositionDefinition } from "./StageAssetCompositionService";

export const PipelineValidationErrorCodes = Object.freeze({
  invalidDefinition: "invalid-definition",
  invalidStageInstance: "invalid-stage-instance",
  invalidTransitions: "invalid-transitions",
  invalidStageComposition: "invalid-stage-composition",
  invalidTemplateInstantiation: "invalid-template-instantiation",
  invalidEditedPipeline: "invalid-edited-pipeline",
} as const);

export type PipelineValidationErrorCode =
  typeof PipelineValidationErrorCodes[keyof typeof PipelineValidationErrorCodes];

export class PipelineValidationError extends Error {
  public readonly code: PipelineValidationErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: PipelineValidationErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "PipelineValidationError";
    this.code = code;
    this.details = details;
  }
}

export interface ValidatePipelineDefinitionInput {
  readonly definition: PipelineDefinition;
  readonly transitions?: ReadonlyArray<PipelineGraphTransition>;
  readonly explicitBranchingStageIds?: ReadonlyArray<PipelineStageId>;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  readonly stageRegistry?: PipelineStageRegistry;
  readonly context?: "template-instantiation" | "pipeline-edit" | "default";
}

export interface ValidatedPipelineArtifacts {
  readonly definition: PipelineDefinition;
  readonly graph: ReturnType<typeof buildPipelineGraph>;
}

function toValidationError(
  context: ValidatePipelineDefinitionInput["context"],
  error: unknown,
): PipelineValidationError {
  if (error instanceof PipelineValidationError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (context === "template-instantiation") {
    return new PipelineValidationError(PipelineValidationErrorCodes.invalidTemplateInstantiation, message);
  }
  if (context === "pipeline-edit") {
    return new PipelineValidationError(PipelineValidationErrorCodes.invalidEditedPipeline, message);
  }
  return new PipelineValidationError(PipelineValidationErrorCodes.invalidDefinition, message);
}

export class PipelineValidationService {
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;

  constructor(input?: {
    readonly stageRegistry?: PipelineStageRegistry;
    readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    this.stageCompositions = input?.stageCompositions;
  }

  public validate(input: ValidatePipelineDefinitionInput): ValidatedPipelineArtifacts {
    const stageRegistry = input.stageRegistry ?? this.stageRegistry;
    const stageCompositions = input.stageCompositions ?? this.stageCompositions;

    try {
      const definition = validatePipelineDefinition(input.definition);

      for (const stageInstance of definition.stageInstances) {
        const stageDefinition = stageRegistry.getDefinition(stageInstance.stageId);
        try {
          createPipelineStageInstance({
            definition: stageDefinition,
            enabled: stageInstance.enabled,
            config: stageInstance.config,
            metadata: stageInstance.metadata,
          });
        } catch (error) {
          throw new PipelineValidationError(
            PipelineValidationErrorCodes.invalidStageInstance,
            error instanceof Error ? error.message : String(error),
            Object.freeze({ stageId: stageInstance.stageId }),
          );
        }
      }

      const graph = buildPipelineGraph({
        stageInstances: definition.stageInstances,
        stageRegistry,
        stageCompositions,
        transitions: input.transitions ?? definition.transitions,
        explicitBranchingStageIds: input.explicitBranchingStageIds ?? definition.explicitBranchingStageIds,
      });

      return Object.freeze({
        definition,
        graph,
      });
    } catch (error) {
      throw toValidationError(input.context ?? "default", error);
    }
  }
}

export function createPipelineValidationService(input?: {
  readonly stageRegistry?: PipelineStageRegistry;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
}): PipelineValidationService {
  return new PipelineValidationService(input);
}

