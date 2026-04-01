import { z } from "zod";
import { createDataStudioPipelineState, deserializeDataStudioPipelineState, serializeDataStudioPipelineState, type DataStudioPipelineState } from "./DataStudioPipelineState";

export const DataStudioPipelineVersionMetadataKind = "data-studio-pipeline-version";
export const DataStudioPipelineVersionMetadataSchemaVersion = "1.0.0";

export interface DataStudioPipelineVersionSummary {
  readonly kind: typeof DataStudioPipelineVersionMetadataKind;
  readonly schemaVersion: typeof DataStudioPipelineVersionMetadataSchemaVersion;
  readonly pipelineId: string;
  readonly pipelineAssetId: string;
  readonly pipelineAssetVersionId: string;
  readonly pipelineName: string;
  readonly pipelineRevision: number;
  readonly stageCount: number;
  readonly enabledStageCount: number;
  readonly completedStageCount: number;
  readonly skippedStageCount: number;
  readonly authoringMode: "wizard" | "canvas";
  readonly currentStageId: string;
  readonly templateId: string;
  readonly lineageId: string;
  readonly reusableAssetId: string;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
}

export interface DataStudioPipelineVersionMetadataEnvelope {
  readonly summary: DataStudioPipelineVersionSummary;
  readonly serializedPipelineState: string;
}

const DataStudioPipelineVersionSummarySchema = z.object({
  kind: z.literal(DataStudioPipelineVersionMetadataKind),
  schemaVersion: z.literal(DataStudioPipelineVersionMetadataSchemaVersion),
  pipelineId: z.string().trim().min(1),
  pipelineAssetId: z.string().trim().min(1),
  pipelineAssetVersionId: z.string().trim().min(1),
  pipelineName: z.string().trim().min(1),
  pipelineRevision: z.number().int().min(1),
  stageCount: z.number().int().nonnegative(),
  enabledStageCount: z.number().int().nonnegative(),
  completedStageCount: z.number().int().nonnegative(),
  skippedStageCount: z.number().int().nonnegative(),
  authoringMode: z.enum(["wizard", "canvas"]),
  currentStageId: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  lineageId: z.string().trim().min(1),
  reusableAssetId: z.string().trim().min(1),
  graphNodeCount: z.number().int().nonnegative(),
  graphEdgeCount: z.number().int().nonnegative(),
});

const DataStudioPipelineVersionMetadataEnvelopeSchema = z.object({
  summary: DataStudioPipelineVersionSummarySchema,
  serializedPipelineState: z.string().trim().min(1),
});

function toSummary(state: DataStudioPipelineState): DataStudioPipelineVersionSummary {
  const enabledStages = state.stages.filter((stage) => stage.enabled);
  return Object.freeze({
    kind: DataStudioPipelineVersionMetadataKind,
    schemaVersion: DataStudioPipelineVersionMetadataSchemaVersion,
    pipelineId: state.identity.pipelineId,
    pipelineAssetId: state.identity.assetId,
    pipelineAssetVersionId: state.identity.assetVersionId,
    pipelineName: state.identity.name,
    pipelineRevision: state.identity.revision,
    stageCount: state.stages.length,
    enabledStageCount: enabledStages.length,
    completedStageCount: state.flow.completedStageIds.length,
    skippedStageCount: state.flow.skippedStageIds.length,
    authoringMode: state.flow.authoringMode,
    currentStageId: state.flow.currentStageId,
    templateId: state.flow.templateId,
    lineageId: state.preparedDatasetLineage.lineageId,
    reusableAssetId: state.preparedDatasetReuse.assetId,
    graphNodeCount: state.compatibility.graphNodeCount,
    graphEdgeCount: state.compatibility.graphEdgeCount,
  });
}

export function createDataStudioPipelineVersionMetadata(
  pipelineState: DataStudioPipelineState,
): DataStudioPipelineVersionMetadataEnvelope {
  const normalized = createDataStudioPipelineState(pipelineState);
  return Object.freeze({
    summary: toSummary(normalized),
    serializedPipelineState: serializeDataStudioPipelineState(normalized),
  });
}

export function parseDataStudioPipelineVersionMetadata(
  metadata: unknown,
): DataStudioPipelineVersionMetadataEnvelope | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const parsed = DataStudioPipelineVersionMetadataEnvelopeSchema.safeParse(metadata);
  if (!parsed.success) {
    return undefined;
  }

  const state = deserializeDataStudioPipelineState(parsed.data.serializedPipelineState);
  return Object.freeze({
    summary: toSummary(state),
    serializedPipelineState: parsed.data.serializedPipelineState,
  });
}
