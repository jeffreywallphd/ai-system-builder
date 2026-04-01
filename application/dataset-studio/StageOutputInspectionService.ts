import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { StageFlowDefinition, StageFlowRuntimeState } from "../../domain/dataset-studio/StageFlowDefinition";
import type { DatasetPipelineStageDefinition } from "../../domain/dataset-studio/StagePipelineDomain";
import type { StageRuntimeTracking } from "./StageMetadataContracts";
import { readRawStorageStageOutput, readUnifiedIngestionStageOutput } from "./StageIntegrationContracts";

export const StageInspectionAvailabilityKinds = Object.freeze({
  available: "available",
  referenceOnly: "reference-only",
  unavailable: "unavailable",
} as const);

export type StageInspectionAvailabilityKind =
  typeof StageInspectionAvailabilityKinds[keyof typeof StageInspectionAvailabilityKinds];

export const StageInspectionStatusKinds = Object.freeze({
  available: "available",
  noOutput: "no-output",
  skipped: "skipped",
  autoConfigured: "auto-configured",
} as const);

export type StageInspectionStatusKind =
  typeof StageInspectionStatusKinds[keyof typeof StageInspectionStatusKinds];

export interface StageOutputInspectionSummaryField {
  readonly label: string;
  readonly value: string;
}

export interface StageOutputInspectionSummary {
  readonly title: string;
  readonly detail: string;
  readonly fields: ReadonlyArray<StageOutputInspectionSummaryField>;
}

export interface StageOutputInspectionContractSummary {
  readonly kind: string;
  readonly acceptedInputShapeKinds: ReadonlyArray<string>;
  readonly producedOutputShapeKinds: ReadonlyArray<string>;
  readonly assetReferenceCount: number;
}

export interface StageOutputInspectionPreview {
  readonly availability: StageInspectionAvailabilityKind;
  readonly reference?: string;
  readonly fallbackSummary?: string;
}

export interface StageOutputInspectionUpstreamMetadata {
  readonly detectedDataType?: string;
  readonly storageReference?: string;
  readonly lineageId?: string;
  readonly pipelineId?: string;
  readonly upstreamStageIds: ReadonlyArray<string>;
}

export interface StageOutputInspectionModel {
  readonly stageId: string;
  readonly status: StageInspectionStatusKind;
  readonly outputSource: "concrete-output" | "stored-reference" | "none";
  readonly summary: StageOutputInspectionSummary;
  readonly contract: StageOutputInspectionContractSummary;
  readonly preview: StageOutputInspectionPreview;
  readonly upstreamMetadata: StageOutputInspectionUpstreamMetadata;
  readonly skipped: boolean;
  readonly autoConfigured: boolean;
  readonly userOverridden: boolean;
}

export interface StageOutputInspectionServiceRequest {
  readonly stageFlow: StageFlowDefinition;
  readonly state: StageFlowRuntimeState;
  readonly stageRuntimeTracking?: Readonly<Record<string, StageRuntimeTracking>>;
}

function toText(value: CanonicalRecordValue | undefined): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function summarizeGenericOutput(
  stageOutput: Readonly<Record<string, CanonicalRecordValue>>,
): StageOutputInspectionSummary {
  const fields = Object.entries(stageOutput)
    .filter(([key]) => key !== "rawStorage" && key !== "unifiedIngestion")
    .slice(0, 6)
    .map(([key, value]) => ({
      label: key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
  if (fields.length === 0) {
    return Object.freeze({
      title: "Output captured",
      detail: "Stage output exists but no summary fields were detected.",
      fields: Object.freeze([]),
    });
  }
  return Object.freeze({
    title: "Output captured",
    detail: `Captured ${fields.length} output field${fields.length === 1 ? "" : "s"}.`,
    fields: Object.freeze(fields),
  });
}

function summarizeUnifiedOutput(
  stageOutput: Readonly<Record<string, CanonicalRecordValue>>,
): StageOutputInspectionSummary | undefined {
  const parsed = readUnifiedIngestionStageOutput(stageOutput);
  if (!parsed) {
    return undefined;
  }
  return Object.freeze({
    title: "Normalized ingestion output",
    detail: `Detected '${parsed.detectedSourceKind}' and produced '${parsed.canonicalOutputKind}' for target '${parsed.outputTarget}'.`,
    fields: Object.freeze([
      Object.freeze({ label: "Status", value: parsed.status }),
      Object.freeze({ label: "Handler", value: parsed.handlerKind ?? "n/a" }),
      Object.freeze({ label: "Fallback", value: parsed.fallbackUsed ? "yes" : "no" }),
      Object.freeze({ label: "Warnings", value: String(parsed.metadata?.warningCount ?? 0) }),
      Object.freeze({ label: "Errors", value: String(parsed.metadata?.errorCount ?? 0) }),
    ]),
  });
}

function summarizeRawStorageOutput(
  stageOutput: Readonly<Record<string, CanonicalRecordValue>>,
): StageOutputInspectionSummary | undefined {
  const parsed = readRawStorageStageOutput(stageOutput);
  if (!parsed) {
    return undefined;
  }
  return Object.freeze({
    title: "Raw storage reference output",
    detail: `Persisted raw source data at '${parsed.persistence.persistedAt}'.`,
    fields: Object.freeze([
      Object.freeze({ label: "Status", value: parsed.status }),
      Object.freeze({ label: "Storage ref", value: parsed.persistence.storageReference ?? "n/a" }),
      Object.freeze({ label: "Digest", value: parsed.persistence.contentDigest ?? "n/a" }),
      Object.freeze({ label: "Byte length", value: String(parsed.persistence.byteLength ?? 0) }),
    ]),
  });
}

function resolveOutputSource(
  stageOutput: Readonly<Record<string, CanonicalRecordValue>> | undefined,
): "concrete-output" | "stored-reference" | "none" {
  if (!stageOutput) {
    return "none";
  }
  const hasStorageReference = Boolean(
    toText(stageOutput.storageReference)
    || toText(stageOutput.contentDigest)
    || toText(stageOutput.persistedAt),
  );
  if (hasStorageReference) {
    return "stored-reference";
  }
  return "concrete-output";
}

function resolveSummary(
  stage: DatasetPipelineStageDefinition,
  stageOutput: Readonly<Record<string, CanonicalRecordValue>> | undefined,
  status: StageInspectionStatusKind,
): StageOutputInspectionSummary {
  if (!stageOutput) {
    if (status === StageInspectionStatusKinds.skipped) {
      return Object.freeze({
        title: "Stage skipped",
        detail: "This stage was skipped and has no direct output payload.",
        fields: Object.freeze([
          Object.freeze({ label: "Stage", value: stage.name }),
        ]),
      });
    }
    if (status === StageInspectionStatusKinds.autoConfigured) {
      return Object.freeze({
        title: "Auto-configured stage",
        detail: "Configuration defaults were applied. No output payload has been produced yet.",
        fields: Object.freeze([
          Object.freeze({ label: "Stage", value: stage.name }),
        ]),
      });
    }
    return Object.freeze({
      title: "No output yet",
      detail: "Run this stage to capture inspectable output.",
      fields: Object.freeze([
        Object.freeze({ label: "Stage", value: stage.name }),
      ]),
    });
  }
  return summarizeRawStorageOutput(stageOutput)
    ?? summarizeUnifiedOutput(stageOutput)
    ?? summarizeGenericOutput(stageOutput);
}

function resolvePreview(
  stageOutput: Readonly<Record<string, CanonicalRecordValue>> | undefined,
  tracking: StageRuntimeTracking | undefined,
  summary: StageOutputInspectionSummary,
): StageOutputInspectionPreview {
  const reference = tracking?.metadata.previewHooks.previewReference
    ?? tracking?.propagated?.previewReference
    ?? toText(stageOutput?.previewReference)
    ?? toText(stageOutput?.lineageId);
  if (reference) {
    return Object.freeze({
      availability: StageInspectionAvailabilityKinds.referenceOnly,
      reference,
    });
  }
  if (stageOutput) {
    return Object.freeze({
      availability: StageInspectionAvailabilityKinds.unavailable,
      fallbackSummary: summary.detail,
    });
  }
  return Object.freeze({
    availability: StageInspectionAvailabilityKinds.unavailable,
    fallbackSummary: "No preview metadata is available for this stage yet.",
  });
}

function resolveStatus(
  stageId: string,
  state: StageFlowRuntimeState,
  hasOutput: boolean,
): StageInspectionStatusKind {
  if (state.skippedStageIds.includes(stageId) && !hasOutput) {
    return StageInspectionStatusKinds.skipped;
  }
  if (state.autoConfiguredStageIds.includes(stageId) && !hasOutput) {
    return StageInspectionStatusKinds.autoConfigured;
  }
  if (!hasOutput) {
    return StageInspectionStatusKinds.noOutput;
  }
  return StageInspectionStatusKinds.available;
}

function inspectStage(
  stage: DatasetPipelineStageDefinition,
  request: StageOutputInspectionServiceRequest,
): StageOutputInspectionModel {
  const stageOutput = request.state.stageOutputs[stage.id];
  const tracking = request.stageRuntimeTracking?.[stage.id];
  const status = resolveStatus(stage.id, request.state, Boolean(stageOutput));
  const summary = resolveSummary(stage, stageOutput, status);
  const preview = resolvePreview(stageOutput, tracking, summary);
  const upstream = tracking?.propagated;

  return Object.freeze({
    stageId: stage.id,
    status,
    outputSource: resolveOutputSource(stageOutput),
    summary,
    contract: Object.freeze({
      kind: tracking?.contract.kind ?? "simple",
      acceptedInputShapeKinds: stage.dataContract.acceptedInputShapeKinds,
      producedOutputShapeKinds: stage.dataContract.producedOutputShapeKinds,
      assetReferenceCount: stage.assetReferences.length,
    }),
    preview,
    upstreamMetadata: Object.freeze({
      detectedDataType: upstream?.detectedDataType,
      storageReference: upstream?.storageReference,
      lineageId: upstream?.lineage.lineageId,
      pipelineId: upstream?.lineage.pipelineId,
      upstreamStageIds: upstream?.lineage.upstreamStageIds ?? Object.freeze([]),
    }),
    skipped: request.state.skippedStageIds.includes(stage.id),
    autoConfigured: request.state.autoConfiguredStageIds.includes(stage.id),
    userOverridden: request.state.userOverriddenStageIds.includes(stage.id),
  });
}

export class StageOutputInspectionService {
  public inspectFlow(
    request: StageOutputInspectionServiceRequest,
  ): Readonly<Record<string, StageOutputInspectionModel>> {
    const models = request.stageFlow.stages.map((stage) => inspectStage(stage, request));
    return Object.freeze(Object.fromEntries(models.map((model) => [model.stageId, model])));
  }

  public inspectStageById(
    request: StageOutputInspectionServiceRequest,
    stageId: string,
  ): StageOutputInspectionModel | undefined {
    const stage = request.stageFlow.stages.find((entry) => entry.id === stageId);
    if (!stage) {
      return undefined;
    }
    return inspectStage(stage, request);
  }
}

export function createStageOutputInspectionService(): StageOutputInspectionService {
  return new StageOutputInspectionService();
}
