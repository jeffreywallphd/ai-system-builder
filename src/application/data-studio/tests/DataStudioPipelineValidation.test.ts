import { describe, expect, it } from "bun:test";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import { DataStudioPreparationWizard } from "../DataStudioPreparationWizard";
import { createDataStudioPipelineState } from "../DataStudioPipelineState";
import { DataStudioPipelineValidationService } from "../DataStudioPipelineValidation";

function withStageOption(
  wizard: DataStudioPreparationWizard,
  stageId: keyof typeof PipelineStageIds,
  patch: Readonly<Record<string, unknown>>,
): void {
  const stage = wizard.getSnapshot().stages.find((entry) => entry.stageId === PipelineStageIds[stageId]);
  wizard.setStageOptions(PipelineStageIds[stageId], Object.freeze({
    ...(stage?.options ?? {}),
    ...patch,
  }) as Readonly<Record<string, CanonicalRecordValue>>);
}

function createValidPipelineState() {
  const wizard = new DataStudioPreparationWizard();
  withStageOption(wizard, "SourceSelection", {
    sourceAssetId: "asset:source-customers:v1",
  });
  withStageOption(wizard, "UnifiedIngestion", {
    outputTarget: "records",
  });
  withStageOption(wizard, "StoragePrepared", {
    destination: "prepared://warehouse/customers",
  });
  return wizard.exportPipelineState();
}

describe("DataStudioPipelineValidationService", () => {
  it("returns execution-ready validation for a valid stage-based pipeline", () => {
    const service = new DataStudioPipelineValidationService();
    const result = service.validate(createValidPipelineState(), { mode: "execution" });

    expect(result.ready).toBeTrue();
    expect(result.executionReady).toBeTrue();
    expect(result.blockingIssues).toHaveLength(0);
  });

  it("enforces chunking dependency on extraction", () => {
    const service = new DataStudioPipelineValidationService();
    const state = createValidPipelineState();
    const nextState = createDataStudioPipelineState({
      ...state,
      stages: Object.freeze(state.stages.map((stage) => {
        if (stage.stageId === PipelineStageIds.Extraction) {
          return Object.freeze({
            ...stage,
            enabled: false,
            activation: Object.freeze({ mode: "disabled" as const }),
          });
        }
        if (stage.stageId === PipelineStageIds.Chunking) {
          return Object.freeze({
            ...stage,
            enabled: true,
            activation: Object.freeze({ mode: "always" as const }),
          });
        }
        return stage;
      })),
    });

    const result = service.validate(nextState, { mode: "execution" });
    expect(result.issues.some((issue) => issue.code === "data-pipeline.chunking.requires-extraction")).toBeTrue();
  });

  it("blocks transition requests when prerequisite stages are incomplete", () => {
    const service = new DataStudioPipelineValidationService();
    const state = createValidPipelineState();
    const result = service.validate(state, {
      mode: "authoring",
      transition: {
        fromStageId: PipelineStageIds.SourceSelection,
        toStageId: PipelineStageIds.Transformation,
      },
    });

    expect(result.issues.some((issue) => issue.code === "data-pipeline.transition.prerequisite-incomplete")).toBeTrue();
  });

  it("blocks execution when prepared storage destination is missing", () => {
    const service = new DataStudioPipelineValidationService();
    const state = createValidPipelineState();
    const nextState = createDataStudioPipelineState({
      ...state,
      stages: Object.freeze(state.stages.map((stage) => (
        stage.stageId === PipelineStageIds.StoragePrepared
          ? Object.freeze({
            ...stage,
            options: Object.freeze({
              ...stage.options,
              destination: "",
            }),
          })
          : stage
      ))),
      unifiedPreparationAsset: Object.freeze({
        ...state.unifiedPreparationAsset,
        storageTarget: undefined,
      }),
      preparedDatasetLineage: Object.freeze({
        ...state.preparedDatasetLineage,
        output: Object.freeze({
          ...state.preparedDatasetLineage.output,
          storageTargetId: undefined,
        }),
      }),
    });

    const result = service.validate(nextState, { mode: "execution" });
    expect(result.executionReady).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "data-pipeline.prepared-storage.missing-destination")).toBeTrue();
  });
});

