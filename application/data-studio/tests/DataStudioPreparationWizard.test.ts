import { describe, expect, it } from "bun:test";
import {
  DataStudioPreparationWizard,
  DataStudioWizardPresentationModes,
  createDefaultDataStudioPreparationAssetDefinition,
} from "../DataStudioPreparationWizard";
import { PipelineStageIds } from "../../../domain/dataset-studio/PipelineStageDomain";
import { UnifiedPreparationStageActivationModes } from "../../../domain/dataset-studio/UnifiedPreparationAsset";

describe("DataStudioPreparationWizard", () => {
  it("navigates forward and backward while preserving stage configuration state", () => {
    const wizard = new DataStudioPreparationWizard();
    const start = wizard.getSnapshot();
    expect(start.currentStageId).toBe(PipelineStageIds.SourceSelection);

    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    const next = wizard.goNext();
    expect(next.moved).toBeTrue();
    expect(next.toStageId).toBe(PipelineStageIds.UnifiedIngestion);

    const afterForward = wizard.getSnapshot();
    expect(afterForward.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options.sourceKind).toBe("json");
    expect(afterForward.completedStageIds).toContain(PipelineStageIds.SourceSelection);

    const back = wizard.goBack();
    expect(back.moved).toBeTrue();
    expect(back.toStageId).toBe(PipelineStageIds.SourceSelection);
  });

  it("blocks progression when validation hooks return errors", () => {
    const wizard = new DataStudioPreparationWizard({
      validationHooks: {
        onCompleteStage: ({ stageId }) => (stageId === PipelineStageIds.SourceSelection
          ? Object.freeze([{
            code: "source.required",
            message: "Source reference is required.",
            severity: "error" as const,
            stageId,
          }])
          : Object.freeze([])),
      },
    });

    const result = wizard.goNext();
    expect(result.moved).toBeFalse();
    expect(result.reason).toContain("Validation hooks");
    expect(result.issues[0]?.code).toBe("source.required");
  });

  it("supports conditional stage activation and skips conditional stage when condition is false", () => {
    const base = createDefaultDataStudioPreparationAssetDefinition();
    const withConditional = Object.freeze({
      ...base,
      stages: Object.freeze(base.stages.map((stage) => (
        stage.stageId === PipelineStageIds.Classification
          ? Object.freeze({
            ...stage,
            activation: Object.freeze({
              mode: UnifiedPreparationStageActivationModes.conditional,
              conditionId: "enable-classification",
            }),
            visibility: "simple" as const,
          })
          : stage
      ))),
    });

    const wizard = new DataStudioPreparationWizard({
      asset: withConditional,
      conditionEvaluators: Object.freeze({
        "enable-classification": (context) => context.stageOptions.SourceSelection?.sourceKind === "classification",
      }),
    });

    wizard.setPresentationMode(DataStudioWizardPresentationModes.advanced);
    wizard.setStageActivation(PipelineStageIds.Profiling, Object.freeze({
      mode: UnifiedPreparationStageActivationModes.always,
    }));
    wizard.goNext(); // SourceSelection -> UnifiedIngestion
    wizard.goNext(); // UnifiedIngestion -> Normalization

    const snapshot = wizard.getSnapshot();
    const classificationStage = snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.Classification);
    expect(classificationStage?.availability.isAvailable).toBeFalse();
    expect(classificationStage?.availability.reason).toBe("condition");
    expect(classificationStage?.status).toBe("skipped");
  });

  it("marks advanced-only stages disabled in simple mode and available in advanced mode", () => {
    const wizard = new DataStudioPreparationWizard();

    wizard.setStageActivation(PipelineStageIds.Enrichment, Object.freeze({
      mode: UnifiedPreparationStageActivationModes.always,
    }));
    const simpleSnapshot = wizard.getSnapshot();
    expect(simpleSnapshot.stages.find((stage) => stage.stageId === PipelineStageIds.Enrichment)?.availability.reason).toBe("visibility");

    wizard.setPresentationMode(DataStudioWizardPresentationModes.advanced);
    const advancedSnapshot = wizard.getSnapshot();
    expect(advancedSnapshot.stages.find((stage) => stage.stageId === PipelineStageIds.Enrichment)?.availability.isAvailable).toBeTrue();
  });
});

