import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineStageId } from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageIds } from "../../domain/dataset-studio/PipelineStageDomain";
import type {
  UnifiedPreparationAssetDefinition,
  UnifiedPreparationStageActivation,
  UnifiedPreparationVisibilityMode,
} from "../../domain/dataset-studio/UnifiedPreparationAsset";
import { createUnifiedPreparationAssetDefinition } from "../../domain/dataset-studio/UnifiedPreparationAsset";
import type {
  DataStudioWizardPresentationMode,
  DataStudioWizardSnapshot,
  DataStudioWizardStageStatus,
} from "./DataStudioPreparationWizard";
import type { StudioAuthoringGraphProjection } from "../studio-shell/StudioAuthoringGraph";

export const DataStudioPipelineStateKind = "data-studio-pipeline-state";
export const DataStudioPipelineStateSchemaVersion = "1.0.0";

export const DataStudioAuthoringModes = Object.freeze({
  wizard: "wizard",
  canvas: "canvas",
} as const);

export type DataStudioAuthoringMode =
  typeof DataStudioAuthoringModes[keyof typeof DataStudioAuthoringModes];

export interface DataStudioPipelineIdentity {
  readonly draftId: string;
  readonly pipelineId: string;
  readonly assetId: string;
  readonly assetVersionId: string;
  readonly name: string;
  readonly description?: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DataStudioPipelineStageState {
  readonly stageId: PipelineStageId;
  readonly order: number;
  readonly enabled: boolean;
  readonly status: DataStudioWizardStageStatus;
  readonly visibility: UnifiedPreparationVisibilityMode;
  readonly configMode: "simple" | "advanced";
  readonly activation: UnifiedPreparationStageActivation;
  readonly options: Readonly<Record<string, CanonicalRecordValue>>;
  readonly assetGroupIds: ReadonlyArray<string>;
}

export interface DataStudioPipelineStageAssetBinding {
  readonly stageId: PipelineStageId;
  readonly assetGroupIds: ReadonlyArray<string>;
  readonly upstreamPipelineAssetIds: ReadonlyArray<string>;
  readonly upstreamOutputStageIds: ReadonlyArray<PipelineStageId>;
}

export interface DataStudioPipelineTransition {
  readonly fromStageId: PipelineStageId;
  readonly toStageId: PipelineStageId;
}

export interface DataStudioPipelineAuthoringFlowState {
  readonly authoringMode: DataStudioAuthoringMode;
  readonly currentStageId: PipelineStageId;
  readonly presentationMode: DataStudioWizardPresentationMode;
  readonly progressiveDisclosureMode: DataStudioWizardPresentationMode;
  readonly templateId: string;
  readonly completedStageIds: ReadonlyArray<PipelineStageId>;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly navigationHistory: ReadonlyArray<PipelineStageId>;
}

export interface DataStudioPipelineWizardCanvasCompatibility {
  readonly source: "pipeline";
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly groupCount: number;
}

export interface DataStudioPipelineState {
  readonly kind: typeof DataStudioPipelineStateKind;
  readonly schemaVersion: typeof DataStudioPipelineStateSchemaVersion;
  readonly identity: DataStudioPipelineIdentity;
  readonly unifiedPreparationAsset: UnifiedPreparationAssetDefinition;
  readonly stages: ReadonlyArray<DataStudioPipelineStageState>;
  readonly assetBindings: ReadonlyArray<DataStudioPipelineStageAssetBinding>;
  readonly transitions: ReadonlyArray<DataStudioPipelineTransition>;
  readonly flow: DataStudioPipelineAuthoringFlowState;
  readonly authoringGraph: StudioAuthoringGraphProjection;
  readonly compatibility: DataStudioPipelineWizardCanvasCompatibility;
}

const StageIdSchema = z.nativeEnum(PipelineStageIds);

const PipelineIdentitySchema = z.object({
  draftId: z.string().trim().min(1),
  pipelineId: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  assetVersionId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  revision: z.number().int().min(1),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

const StageStateSchema = z.object({
  stageId: StageIdSchema,
  order: z.number().int().positive(),
  enabled: z.boolean(),
  status: z.enum(["current", "completed", "skipped", "pending", "disabled"]),
  visibility: z.enum(["simple", "advanced"]),
  configMode: z.enum(["simple", "advanced"]),
  activation: z.object({
    mode: z.enum(["always", "conditional", "disabled"]),
    conditionId: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).optional(),
  }),
  options: z.record(z.any()),
  assetGroupIds: z.array(z.string().trim().min(1)),
});

const StageBindingSchema = z.object({
  stageId: StageIdSchema,
  assetGroupIds: z.array(z.string().trim().min(1)),
  upstreamPipelineAssetIds: z.array(z.string().trim().min(1)),
  upstreamOutputStageIds: z.array(StageIdSchema),
});

const TransitionSchema = z.object({
  fromStageId: StageIdSchema,
  toStageId: StageIdSchema,
});

const FlowStateSchema = z.object({
  authoringMode: z.nativeEnum(DataStudioAuthoringModes),
  currentStageId: StageIdSchema,
  presentationMode: z.enum(["simple", "advanced"]),
  progressiveDisclosureMode: z.enum(["simple", "advanced"]),
  templateId: z.string().trim().min(1),
  completedStageIds: z.array(StageIdSchema),
  skippedStageIds: z.array(StageIdSchema),
  navigationHistory: z.array(StageIdSchema),
});

const GraphProjectionSchema = z.object({
  source: z.literal("pipeline"),
  nodes: z.array(z.object({
    id: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    label: z.string().trim().min(1),
    groupId: z.string().trim().min(1).optional(),
    metadata: z.record(z.any()).optional(),
  })),
  edges: z.array(z.object({
    id: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    sourceNodeId: z.string().trim().min(1),
    targetNodeId: z.string().trim().min(1),
    metadata: z.record(z.any()).optional(),
  })),
  groups: z.array(z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    order: z.number().int().positive(),
    nodeIds: z.array(z.string().trim().min(1)),
  })),
});

const CompatibilitySchema = z.object({
  source: z.literal("pipeline"),
  graphNodeCount: z.number().int().nonnegative(),
  graphEdgeCount: z.number().int().nonnegative(),
  groupCount: z.number().int().nonnegative(),
});

const DataStudioPipelineStateSchema = z.object({
  kind: z.literal(DataStudioPipelineStateKind),
  schemaVersion: z.literal(DataStudioPipelineStateSchemaVersion),
  identity: PipelineIdentitySchema,
  unifiedPreparationAsset: z.unknown(),
  stages: z.array(StageStateSchema).min(1),
  assetBindings: z.array(StageBindingSchema).min(1),
  transitions: z.array(TransitionSchema),
  flow: FlowStateSchema,
  authoringGraph: GraphProjectionSchema,
  compatibility: CompatibilitySchema,
});

function dedupeStageIds(ids: ReadonlyArray<PipelineStageId>): ReadonlyArray<PipelineStageId> {
  return Object.freeze([...new Set(ids)]);
}

function dedupeStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]);
}

function toDefaultIdentity(snapshot: DataStudioWizardSnapshot): DataStudioPipelineIdentity {
  const now = new Date().toISOString();
  return Object.freeze({
    draftId: `data-studio-draft:${snapshot.assetId}`,
    pipelineId: `data-studio-pipeline:${snapshot.assetId}`,
    assetId: snapshot.assetId,
    assetVersionId: snapshot.versionId,
    name: snapshot.template.name,
    description: snapshot.template.description,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });
}

function assertStateIntegrity(state: DataStudioPipelineState): void {
  const stageIds = new Set(state.stages.map((stage) => stage.stageId));
  if (!stageIds.has(state.flow.currentStageId)) {
    throw new Error(`Pipeline flow current stage '${state.flow.currentStageId}' is not present in stage state.`);
  }

  const requiredEnabled = [
    PipelineStageIds.SourceSelection,
    PipelineStageIds.UnifiedIngestion,
    PipelineStageIds.StoragePrepared,
  ] as const;
  for (const requiredStage of requiredEnabled) {
    const stage = state.stages.find((entry) => entry.stageId === requiredStage);
    if (!stage || !stage.enabled) {
      throw new Error(`Required stage '${requiredStage}' must remain enabled in persistent pipeline state.`);
    }
  }

  for (const stageId of [...state.flow.completedStageIds, ...state.flow.skippedStageIds, ...state.flow.navigationHistory]) {
    if (!stageIds.has(stageId)) {
      throw new Error(`Pipeline flow references unknown stage '${stageId}'.`);
    }
  }

  const bindingStageIds = new Set<string>();
  for (const binding of state.assetBindings) {
    if (!stageIds.has(binding.stageId)) {
      throw new Error(`Asset binding references unknown stage '${binding.stageId}'.`);
    }
    if (bindingStageIds.has(binding.stageId)) {
      throw new Error(`Asset binding for stage '${binding.stageId}' is duplicated.`);
    }
    bindingStageIds.add(binding.stageId);
  }
}

export function createDataStudioPipelineState(
  input: DataStudioPipelineState,
): DataStudioPipelineState {
  const parsed = DataStudioPipelineStateSchema.parse(input);
  const unifiedPreparationAsset = createUnifiedPreparationAssetDefinition(
    parsed.unifiedPreparationAsset as UnifiedPreparationAssetDefinition,
  );

  const normalized: DataStudioPipelineState = Object.freeze({
    kind: DataStudioPipelineStateKind,
    schemaVersion: DataStudioPipelineStateSchemaVersion,
    identity: Object.freeze({
      ...parsed.identity,
      draftId: parsed.identity.draftId.trim(),
      pipelineId: parsed.identity.pipelineId.trim(),
      assetId: parsed.identity.assetId.trim(),
      assetVersionId: parsed.identity.assetVersionId.trim(),
      name: parsed.identity.name.trim(),
      description: parsed.identity.description?.trim() || undefined,
    }),
    unifiedPreparationAsset,
    stages: Object.freeze(
      parsed.stages
        .map((stage) => Object.freeze({
          ...stage,
          assetGroupIds: dedupeStrings(stage.assetGroupIds),
        }))
        .sort((left, right) => left.order - right.order),
    ),
    assetBindings: Object.freeze(parsed.assetBindings.map((binding) => Object.freeze({
      ...binding,
      assetGroupIds: dedupeStrings(binding.assetGroupIds),
      upstreamPipelineAssetIds: dedupeStrings(binding.upstreamPipelineAssetIds),
      upstreamOutputStageIds: dedupeStageIds(binding.upstreamOutputStageIds),
    }))),
    transitions: Object.freeze(parsed.transitions.map((transition) => Object.freeze({ ...transition }))),
    flow: Object.freeze({
      ...parsed.flow,
      completedStageIds: dedupeStageIds(parsed.flow.completedStageIds),
      skippedStageIds: dedupeStageIds(parsed.flow.skippedStageIds),
      navigationHistory: dedupeStageIds(parsed.flow.navigationHistory),
      templateId: parsed.flow.templateId.trim(),
    }),
    authoringGraph: Object.freeze({
      source: "pipeline",
      nodes: Object.freeze(parsed.authoringGraph.nodes.map((node) => Object.freeze({ ...node }))),
      edges: Object.freeze(parsed.authoringGraph.edges.map((edge) => Object.freeze({ ...edge }))),
      groups: Object.freeze(parsed.authoringGraph.groups.map((group) => Object.freeze({ ...group }))),
    }),
    compatibility: Object.freeze({
      source: "pipeline",
      graphNodeCount: parsed.compatibility.graphNodeCount,
      graphEdgeCount: parsed.compatibility.graphEdgeCount,
      groupCount: parsed.compatibility.groupCount,
    }),
  });

  assertStateIntegrity(normalized);
  return normalized;
}

export function createDataStudioPipelineStateFromWizard(input: {
  readonly snapshot: DataStudioWizardSnapshot;
  readonly asset: UnifiedPreparationAssetDefinition;
  readonly navigationHistory: ReadonlyArray<PipelineStageId>;
  readonly authoringMode?: DataStudioAuthoringMode;
  readonly identity?: Partial<DataStudioPipelineIdentity>;
}): DataStudioPipelineState {
  const stageDescriptors = [...input.snapshot.stages].sort((left, right) => left.order - right.order);
  const transitions = stageDescriptors.slice(0, -1).map((stage, index) => Object.freeze({
    fromStageId: stage.stageId,
    toStageId: stageDescriptors[index + 1]?.stageId ?? stage.stageId,
  }));
  const identity = input.identity;
  const defaults = toDefaultIdentity(input.snapshot);
  const currentRevision = identity?.revision ?? defaults.revision;
  const now = new Date().toISOString();
  const upstreamOutputStages = dedupeStageIds(
    input.asset.upstreamBindings
      .map((binding) => binding.outputStageId)
      .filter((stageId): stageId is PipelineStageId => typeof stageId === "string"),
  );

  return createDataStudioPipelineState({
    kind: DataStudioPipelineStateKind,
    schemaVersion: DataStudioPipelineStateSchemaVersion,
    identity: Object.freeze({
      draftId: identity?.draftId?.trim() || defaults.draftId,
      pipelineId: identity?.pipelineId?.trim() || defaults.pipelineId,
      assetId: input.snapshot.assetId,
      assetVersionId: input.snapshot.versionId,
      name: identity?.name?.trim() || defaults.name,
      description: identity?.description?.trim() || defaults.description,
      revision: currentRevision,
      createdAt: identity?.createdAt?.trim() || defaults.createdAt,
      updatedAt: now,
    }),
    unifiedPreparationAsset: input.asset,
    stages: Object.freeze(stageDescriptors.map((stage) => Object.freeze({
      stageId: stage.stageId,
      order: stage.order,
      enabled: stage.availability.isAvailable,
      status: stage.status,
      visibility: stage.visibility,
      configMode: stage.configMode,
      activation: stage.activation,
      options: stage.options,
      assetGroupIds: stage.assetGroupIds,
    }))),
    assetBindings: Object.freeze(stageDescriptors.map((stage) => Object.freeze({
      stageId: stage.stageId,
      assetGroupIds: stage.assetGroupIds,
      upstreamPipelineAssetIds: input.asset.upstreamBindings.map((binding) => binding.pipelineAssetId),
      upstreamOutputStageIds: upstreamOutputStages,
    }))),
    transitions: Object.freeze(transitions.filter((transition) => transition.fromStageId !== transition.toStageId)),
    flow: Object.freeze({
      authoringMode: input.authoringMode ?? DataStudioAuthoringModes.wizard,
      currentStageId: input.snapshot.currentStageId,
      presentationMode: input.snapshot.presentationMode,
      progressiveDisclosureMode: input.snapshot.presentationMode,
      templateId: input.snapshot.template.id,
      completedStageIds: input.snapshot.completedStageIds,
      skippedStageIds: input.snapshot.skippedStageIds,
      navigationHistory: dedupeStageIds(input.navigationHistory),
    }),
    authoringGraph: input.snapshot.authoringGraph,
    compatibility: Object.freeze({
      source: "pipeline",
      graphNodeCount: input.snapshot.authoringGraph.nodes.length,
      graphEdgeCount: input.snapshot.authoringGraph.edges.length,
      groupCount: input.snapshot.authoringGraph.groups.length,
    }),
  });
}

export function serializeDataStudioPipelineState(state: DataStudioPipelineState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeDataStudioPipelineState(value: string): DataStudioPipelineState {
  return createDataStudioPipelineState(JSON.parse(value) as DataStudioPipelineState);
}
