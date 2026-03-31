import {
  deserializePipelineDefinition,
  serializePipelineDefinition,
  validatePipelineDefinition,
  type PipelineDefinition,
  type PipelineTransitionDefinition,
} from "../../domain/dataset-studio/PipelineDefinitionDomain";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createPipelineStageInstance,
  PipelineStageIds,
  type PipelineStageConfig,
  type PipelineStageDefinition,
  type PipelineStageId,
  type PipelineStageInstance,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import type { PipelineGraphTransition } from "./PipelineGraphConstructionService";
import { buildPipelineGraph } from "./PipelineGraphConstructionService";
import {
  buildReactFlowGraph,
  type PipelineReactFlowGraph,
} from "./PipelineReactFlowGraph";
import {
  StageAssetCompositionService,
  type StageCompositionDefinition,
} from "./StageAssetCompositionService";
import {
  parseFeatureEngineeringStageConfigFromStageOptions,
  toFeatureEngineeringStageOptions,
} from "../../domain/dataset-studio/FeatureEngineeringStageDomain";
import {
  parseLabelingStageConfigFromStageOptions,
  toLabelingStageOptions,
} from "../../domain/dataset-studio/LabelingStageDomain";

export const PipelineEditErrorCodes = Object.freeze({
  unknownStage: "unknown-stage",
  duplicateStage: "duplicate-stage",
  requiredStageRemoval: "required-stage-removal",
  requiredStageDisable: "required-stage-disable",
  invalidPosition: "invalid-position",
  stageNotInPipeline: "stage-not-in-pipeline",
  invalidEdit: "invalid-edit",
} as const);

export type PipelineEditErrorCode =
  typeof PipelineEditErrorCodes[keyof typeof PipelineEditErrorCodes];

export class PipelineEditError extends Error {
  public readonly code: PipelineEditErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: PipelineEditErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "PipelineEditError";
    this.code = code;
    this.details = details;
  }
}

export interface StageReplacementConfigPreservation {
  readonly preservedOptionKeys: ReadonlyArray<string>;
  readonly droppedOptionKeys: ReadonlyArray<string>;
  readonly preservedDeclaredInputType: boolean;
  readonly preservedExpectedOutputType: boolean;
  readonly preservedMetadataKeys: ReadonlyArray<string>;
  readonly droppedMetadataKeys: ReadonlyArray<string>;
}

export interface PipelineEditResult {
  readonly definition: PipelineDefinition;
  readonly pipelineGraph: ReturnType<typeof buildPipelineGraph>;
  readonly reactFlowGraph: PipelineReactFlowGraph;
  readonly replaceConfigPreservation?: StageReplacementConfigPreservation;
}

function normalizePosition(position: number, min: number, max: number): number {
  if (!Number.isInteger(position) || position < min || position > max) {
    throw new PipelineEditError(
      PipelineEditErrorCodes.invalidPosition,
      `Position '${position}' is out of range ${min}-${max}.`,
      Object.freeze({ position, min, max }),
    );
  }
  return position;
}

function toTransitions(
  transitions?: ReadonlyArray<PipelineTransitionDefinition>,
): ReadonlyArray<PipelineGraphTransition> | undefined {
  return transitions?.map((transition) => Object.freeze({
    fromStageId: transition.fromStageId,
    toStageId: transition.toStageId,
  }));
}

function toStageOrderMap(stageInstances: ReadonlyArray<PipelineStageInstance>): ReadonlyMap<PipelineStageId, number> {
  return new Map(stageInstances.map((stage, index) => [stage.stageId, index + 1]));
}

function sanitizeTransitions(
  definition: PipelineDefinition,
  stageInstances: ReadonlyArray<PipelineStageInstance>,
  replaceMap?: ReadonlyMap<PipelineStageId, PipelineStageId>,
): ReadonlyArray<PipelineTransitionDefinition> | undefined {
  if (!definition.transitions) {
    return undefined;
  }

  const stageOrderById = toStageOrderMap(stageInstances);
  const existingStageIds = new Set(stageInstances.map((stage) => stage.stageId));
  const dedupe = new Set<string>();
  const normalized: PipelineTransitionDefinition[] = [];

  for (const transition of definition.transitions) {
    const mappedSource = replaceMap?.get(transition.fromStageId) ?? transition.fromStageId;
    const mappedTarget = replaceMap?.get(transition.toStageId) ?? transition.toStageId;
    if (!existingStageIds.has(mappedSource) || !existingStageIds.has(mappedTarget) || mappedSource === mappedTarget) {
      continue;
    }
    const sourceOrder = stageOrderById.get(mappedSource) ?? 0;
    const targetOrder = stageOrderById.get(mappedTarget) ?? 0;
    if (targetOrder <= sourceOrder) {
      continue;
    }
    const key = `${mappedSource}->${mappedTarget}`;
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    normalized.push(Object.freeze({
      fromStageId: mappedSource,
      toStageId: mappedTarget,
    }));
  }

  if (normalized.length === 0 && stageInstances.length > 1) {
    return Object.freeze(stageInstances.slice(0, -1).map((stage, index) => {
      const next = stageInstances[index + 1];
      if (!next) {
        throw new Error(`Unable to resolve transition target for '${stage.stageId}'.`);
      }
      return Object.freeze({ fromStageId: stage.stageId, toStageId: next.stageId });
    }));
  }

  return Object.freeze(normalized);
}

function sanitizeBranchingStageIds(
  branchingStageIds: ReadonlyArray<PipelineStageId> | undefined,
  stageInstances: ReadonlyArray<PipelineStageInstance>,
): ReadonlyArray<PipelineStageId> | undefined {
  if (!branchingStageIds || branchingStageIds.length === 0) {
    return undefined;
  }
  const existing = new Set(stageInstances.map((stage) => stage.stageId));
  const normalized = branchingStageIds.filter((stageId) => existing.has(stageId));
  return normalized.length > 0 ? Object.freeze([...new Set(normalized)]) : undefined;
}

export class PipelineEditingService {
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly compositionService: StageAssetCompositionService;

  constructor(input?: {
    readonly stageRegistry?: PipelineStageRegistry;
    readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    this.compositionService = new StageAssetCompositionService(input?.stageCompositions);
  }

  public addStage(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
    position: number,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    if (!this.stageRegistry.has(stageId)) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.unknownStage,
        `Stage '${stageId}' is not registered.`,
      );
    }
    if (current.stageInstances.some((stage) => stage.stageId === stageId)) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.duplicateStage,
        `Stage '${stageId}' already exists in this pipeline.`,
      );
    }

    const targetPosition = normalizePosition(position, 1, current.stageInstances.length + 1);
    const stageDefinition = this.stageRegistry.getDefinition(stageId);
    const instance = createPipelineStageInstance({ definition: stageDefinition });

    const stageInstances = [...current.stageInstances];
    stageInstances.splice(targetPosition - 1, 0, instance);

    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances)),
      explicitBranchingStageIds: sanitizeBranchingStageIds(current.explicitBranchingStageIds, Object.freeze(stageInstances)),
    }));

    return this.regenerate(nextDefinition);
  }

  public removeStage(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    const stageIndex = current.stageInstances.findIndex((stage) => stage.stageId === stageId);
    if (stageIndex < 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.stageNotInPipeline,
        `Stage '${stageId}' is not present in this pipeline.`,
      );
    }

    const stageDefinition = this.stageRegistry.getDefinition(stageId);
    if (!stageDefinition.isOptional) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.requiredStageRemoval,
        `Required stage '${stageId}' cannot be removed.`,
      );
    }

    const stageInstances = [...current.stageInstances];
    stageInstances.splice(stageIndex, 1);
    if (stageInstances.length === 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.invalidEdit,
        "Pipeline cannot remove the final stage.",
      );
    }

    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances)),
      explicitBranchingStageIds: sanitizeBranchingStageIds(current.explicitBranchingStageIds, Object.freeze(stageInstances)),
    }));

    return this.regenerate(nextDefinition);
  }

  public replaceStage(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
    newStageId: PipelineStageId,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    const stageIndex = current.stageInstances.findIndex((stage) => stage.stageId === stageId);
    if (stageIndex < 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.stageNotInPipeline,
        `Stage '${stageId}' is not present in this pipeline.`,
      );
    }
    if (!this.stageRegistry.has(newStageId)) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.unknownStage,
        `Replacement stage '${newStageId}' is not registered.`,
      );
    }
    if (stageId !== newStageId && current.stageInstances.some((stage) => stage.stageId === newStageId)) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.duplicateStage,
        `Stage '${newStageId}' already exists in this pipeline.`,
      );
    }

    const currentStage = current.stageInstances[stageIndex];
    if (!currentStage) {
      throw new PipelineEditError(PipelineEditErrorCodes.invalidEdit, "Unable to resolve stage to replace.");
    }
    const newStageDefinition = this.stageRegistry.getDefinition(newStageId);
    const configPreservation = this.mapReplacementConfiguration(currentStage, newStageDefinition);

    const replacement = createPipelineStageInstance({
      definition: newStageDefinition,
      enabled: currentStage.enabled,
      config: configPreservation.config,
      metadata: configPreservation.metadata,
    });

    const stageInstances = [...current.stageInstances];
    stageInstances.splice(stageIndex, 1, replacement);

    const replaceMap = new Map<PipelineStageId, PipelineStageId>([[stageId, newStageId]]);
    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances), replaceMap),
      explicitBranchingStageIds: sanitizeBranchingStageIds(
        current.explicitBranchingStageIds?.map((id) => replaceMap.get(id) ?? id),
        Object.freeze(stageInstances),
      ),
    }));

    const result = this.regenerate(nextDefinition);
    return Object.freeze({
      ...result,
      replaceConfigPreservation: configPreservation.report,
    });
  }

  public reorderStage(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
    newPosition: number,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    const currentIndex = current.stageInstances.findIndex((stage) => stage.stageId === stageId);
    if (currentIndex < 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.stageNotInPipeline,
        `Stage '${stageId}' is not present in this pipeline.`,
      );
    }

    const targetPosition = normalizePosition(newPosition, 1, current.stageInstances.length);
    const stageInstances = [...current.stageInstances];
    const moving = stageInstances[currentIndex];
    if (!moving) {
      throw new PipelineEditError(PipelineEditErrorCodes.invalidEdit, "Unable to resolve stage to reorder.");
    }

    stageInstances.splice(currentIndex, 1);
    stageInstances.splice(targetPosition - 1, 0, moving);

    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances)),
      explicitBranchingStageIds: sanitizeBranchingStageIds(current.explicitBranchingStageIds, Object.freeze(stageInstances)),
    }));

    return this.regenerate(nextDefinition);
  }

  public toggleStage(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
    enabled: boolean,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    const stageIndex = current.stageInstances.findIndex((stage) => stage.stageId === stageId);
    if (stageIndex < 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.stageNotInPipeline,
        `Stage '${stageId}' is not present in this pipeline.`,
      );
    }

    const stageDefinition = this.stageRegistry.getDefinition(stageId);
    if (!enabled && !stageDefinition.isOptional) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.requiredStageDisable,
        `Required stage '${stageId}' cannot be disabled.`,
      );
    }

    const stageInstances = [...current.stageInstances];
    const currentStage = stageInstances[stageIndex];
    if (!currentStage) {
      throw new PipelineEditError(PipelineEditErrorCodes.invalidEdit, "Unable to resolve stage to toggle.");
    }
    stageInstances.splice(stageIndex, 1, Object.freeze({
      ...currentStage,
      enabled,
    }));

    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances)),
      explicitBranchingStageIds: sanitizeBranchingStageIds(current.explicitBranchingStageIds, Object.freeze(stageInstances)),
    }));

    return this.regenerate(nextDefinition);
  }

  public updateStageConfiguration(
    definition: PipelineDefinition,
    stageId: PipelineStageId,
    optionPatch: Readonly<Record<string, CanonicalRecordValue>>,
  ): PipelineEditResult {
    const current = validatePipelineDefinition(definition);
    const stageIndex = current.stageInstances.findIndex((stage) => stage.stageId === stageId);
    if (stageIndex < 0) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.stageNotInPipeline,
        `Stage '${stageId}' is not present in this pipeline.`,
      );
    }

    const currentStage = current.stageInstances[stageIndex];
    if (!currentStage) {
      throw new PipelineEditError(PipelineEditErrorCodes.invalidEdit, "Unable to resolve stage to configure.");
    }

    const mergedOptions = Object.freeze({
      ...currentStage.config.options,
      ...optionPatch,
    });

    const normalizedOptions = stageId === PipelineStageIds.Labeling
      ? toLabelingStageOptions(
        parseLabelingStageConfigFromStageOptions(mergedOptions, currentStage.config.declaredInputType),
      )
      : stageId === PipelineStageIds.FeatureEngineering
        ? toFeatureEngineeringStageOptions(
          parseFeatureEngineeringStageConfigFromStageOptions(mergedOptions),
        )
        : mergedOptions;

    const replacement = createPipelineStageInstance({
      definition: this.stageRegistry.getDefinition(stageId),
      enabled: currentStage.enabled,
      config: {
        mode: currentStage.config.mode,
        declaredInputType: currentStage.config.declaredInputType,
        expectedOutputType: currentStage.config.expectedOutputType,
        options: normalizedOptions,
      },
      metadata: currentStage.metadata,
    });

    const stageInstances = [...current.stageInstances];
    stageInstances.splice(stageIndex, 1, replacement);
    const nextDefinition = validatePipelineDefinition(Object.freeze({
      stageInstances: Object.freeze(stageInstances),
      transitions: sanitizeTransitions(current, Object.freeze(stageInstances)),
      explicitBranchingStageIds: sanitizeBranchingStageIds(current.explicitBranchingStageIds, Object.freeze(stageInstances)),
    }));

    return this.regenerate(nextDefinition);
  }

  public serialize(definition: PipelineDefinition): string {
    return serializePipelineDefinition(definition);
  }

  public deserialize(serialized: string): PipelineDefinition {
    return deserializePipelineDefinition(serialized);
  }

  private regenerate(definition: PipelineDefinition): PipelineEditResult {
    try {
      const pipelineGraph = buildPipelineGraph({
        stageInstances: definition.stageInstances,
        stageRegistry: this.stageRegistry,
        stageCompositions: this.compositionService.listDefinitions(),
        transitions: toTransitions(definition.transitions),
        explicitBranchingStageIds: definition.explicitBranchingStageIds,
      });
      const reactFlowGraph = buildReactFlowGraph(pipelineGraph);
      return Object.freeze({
        definition,
        pipelineGraph,
        reactFlowGraph,
      });
    } catch (error) {
      throw new PipelineEditError(
        PipelineEditErrorCodes.invalidEdit,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private mapReplacementConfiguration(
    currentStage: PipelineStageInstance,
    newStageDefinition: PipelineStageDefinition,
  ): {
    readonly config: Partial<PipelineStageConfig>;
    readonly metadata: Partial<PipelineStageInstance["metadata"]>;
    readonly report: StageReplacementConfigPreservation;
  } {
    const optionKeySet = this.getStageConfigKeys(newStageDefinition.id);
    const preservedOptionKeys: string[] = [];
    const droppedOptionKeys: string[] = [];
    const nextOptions: Record<string, CanonicalRecordValue> = {};

    for (const [key, value] of Object.entries(currentStage.config.options)) {
      if (optionKeySet.has(key)) {
        nextOptions[key] = value;
        preservedOptionKeys.push(key);
      } else {
        droppedOptionKeys.push(key);
      }
    }

    const declaredInputType = currentStage.config.declaredInputType;
    const expectedOutputType = currentStage.config.expectedOutputType;
    const preservedDeclaredInputType = Boolean(
      declaredInputType && newStageDefinition.allowedInputTypes.includes(declaredInputType),
    );
    const preservedExpectedOutputType = Boolean(
      expectedOutputType && newStageDefinition.producedOutputTypes.includes(expectedOutputType),
    );

    const preservedMetadataKeys = ["tags", "inspectable"];
    const droppedMetadataKeys = ["previewReference", "sourceReference", "attributes"];

    return Object.freeze({
      config: Object.freeze({
        mode: currentStage.config.mode,
        declaredInputType: preservedDeclaredInputType ? declaredInputType : undefined,
        expectedOutputType: preservedExpectedOutputType ? expectedOutputType : undefined,
        options: Object.freeze(nextOptions),
      }),
      metadata: Object.freeze({
        tags: currentStage.metadata.tags,
        inspectable: currentStage.metadata.inspectable,
      }),
      report: Object.freeze({
        preservedOptionKeys: Object.freeze(preservedOptionKeys.sort()),
        droppedOptionKeys: Object.freeze(droppedOptionKeys.sort()),
        preservedDeclaredInputType,
        preservedExpectedOutputType,
        preservedMetadataKeys: Object.freeze(preservedMetadataKeys),
        droppedMetadataKeys: Object.freeze(droppedMetadataKeys),
      }),
    });
  }

  private getStageConfigKeys(stageId: PipelineStageId): ReadonlySet<string> {
    const definition = this.compositionService.getDefinition(stageId);
    const keys = new Set<string>();
    for (const group of definition.groups) {
      for (const asset of group.assets) {
        for (const mapping of asset.configMapping) {
          keys.add(mapping.stageConfigKey);
        }
      }
    }
    return keys;
  }
}

export function createPipelineEditingService(input?: {
  readonly stageRegistry?: PipelineStageRegistry;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
}): PipelineEditingService {
  return new PipelineEditingService(input);
}
