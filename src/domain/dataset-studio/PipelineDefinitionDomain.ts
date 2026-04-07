import { z } from "zod";
import type { PipelineStageId, PipelineStageInstance } from "./PipelineStageDomain";
import { PipelineStageIds, PipelineStageInstanceSchema } from "./PipelineStageDomain";

export interface PipelineTransitionDefinition {
  readonly fromStageId: PipelineStageId;
  readonly toStageId: PipelineStageId;
}

export interface PipelineDefinition {
  readonly stageInstances: ReadonlyArray<PipelineStageInstance>;
  readonly transitions?: ReadonlyArray<PipelineTransitionDefinition>;
  readonly explicitBranchingStageIds?: ReadonlyArray<PipelineStageId>;
}

const StageIdSchema = z.nativeEnum(PipelineStageIds);

export const PipelineTransitionDefinitionSchema = z.object({
  fromStageId: StageIdSchema,
  toStageId: StageIdSchema,
});

export const PipelineDefinitionSchema = z.object({
  stageInstances: z.array(PipelineStageInstanceSchema).min(1),
  transitions: z.array(PipelineTransitionDefinitionSchema).optional(),
  explicitBranchingStageIds: z.array(StageIdSchema).optional(),
});

function assertNoDuplicateStageIds(stageInstances: ReadonlyArray<PipelineStageInstance>): void {
  const seen = new Set<PipelineStageId>();
  for (const instance of stageInstances) {
    if (seen.has(instance.stageId)) {
      throw new Error(`Pipeline definition includes duplicate stage '${instance.stageId}'.`);
    }
    seen.add(instance.stageId);
  }
}

export function validatePipelineDefinition(value: PipelineDefinition): PipelineDefinition {
  const parsed = PipelineDefinitionSchema.parse(value) as PipelineDefinition;
  assertNoDuplicateStageIds(parsed.stageInstances);
  return Object.freeze({
    stageInstances: Object.freeze(parsed.stageInstances.map((stage) => Object.freeze(stage))),
    transitions: parsed.transitions
      ? Object.freeze(parsed.transitions.map((transition) => Object.freeze(transition)))
      : undefined,
    explicitBranchingStageIds: parsed.explicitBranchingStageIds
      ? Object.freeze([...new Set(parsed.explicitBranchingStageIds)])
      : undefined,
  });
}

export function serializePipelineDefinition(definition: PipelineDefinition): string {
  return JSON.stringify(validatePipelineDefinition(definition));
}

export function deserializePipelineDefinition(serialized: string): PipelineDefinition {
  return validatePipelineDefinition(JSON.parse(serialized) as PipelineDefinition);
}
