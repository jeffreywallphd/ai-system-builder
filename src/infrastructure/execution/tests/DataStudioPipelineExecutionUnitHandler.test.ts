import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionUnitKinds } from "../../../src/domain/execution/ExecutionPlan";
import { PipelineStageIds } from "../../../src/domain/dataset-studio/PipelineStageDomain";
import { DataStudioPreparationWizard } from "../../../application/data-studio/DataStudioPreparationWizard";
import {
  DataStudioPipelineExecutionArtifacts,
  type DataStudioPipelineExecutionUnitInput,
} from "../../../application/data-studio/DataStudioPipelineExecution";
import { DataStudioPipelineExecutionUnitHandler } from "../DataStudioPipelineExecutionUnitHandler";

function createExecutionInput(): DataStudioPipelineExecutionUnitInput {
  const wizard = new DataStudioPreparationWizard();
  const sourceStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
  wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
    ...(sourceStage?.options ?? {}),
    sourceAssetId: "asset:source-customers:v1",
  }));
  const ingestionStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.UnifiedIngestion);
  wizard.setStageOptions(PipelineStageIds.UnifiedIngestion, Object.freeze({
    ...(ingestionStage?.options ?? {}),
    outputTarget: "records",
  }));
  const preparedStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
  wizard.setStageOptions(PipelineStageIds.StoragePrepared, Object.freeze({
    ...(preparedStage?.options ?? {}),
    destination: "prepared://warehouse/customers",
  }));

  return Object.freeze({
    pipelineState: wizard.exportPipelineState(),
    initiatedBy: "test",
    executionReason: "unit-test",
  });
}

describe("DataStudioPipelineExecutionUnitHandler", () => {
  it("executes stage-based data pipelines and emits execution artifacts", async () => {
    const handler = new DataStudioPipelineExecutionUnitHandler();
    const plan = new ExecutionPlan({
      id: "data-pipeline:test",
      units: [
        {
          id: "data-pipeline:test",
          kind: ExecutionUnitKinds.dataPipeline,
        },
      ],
    });

    const result = await handler.execute({
      plan,
      runId: "run:data-pipeline:test",
      unit: plan.units[0]!,
      unitInputs: {
        "data-pipeline:test": createExecutionInput(),
      },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts?.some((artifact) => artifact.kind === DataStudioPipelineExecutionArtifacts.pipelineExecutionResult)).toBeTrue();
    expect(result.outputMetadata?.pipelineId).toContain("data-studio-pipeline:");
  });
});
