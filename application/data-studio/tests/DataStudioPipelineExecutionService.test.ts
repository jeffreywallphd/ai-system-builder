import { describe, expect, it } from "bun:test";
import { UnifiedExecutionEngine } from "../../execution/UnifiedExecutionEngine";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { PipelineStageIds } from "../../../domain/dataset-studio/PipelineStageDomain";
import { DataStudioPreparationWizard } from "../DataStudioPreparationWizard";
import { DataStudioPipelineExecutionService } from "../DataStudioPipelineExecutionService";
import { DataStudioPipelineExecutionUnitHandler } from "../../../infrastructure/execution/DataStudioPipelineExecutionUnitHandler";

function withStageOptions(
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

function createReadyState() {
  const wizard = new DataStudioPreparationWizard();
  withStageOptions(wizard, "SourceSelection", {
    sourceAssetId: "asset:source-customers:v1",
  });
  withStageOptions(wizard, "UnifiedIngestion", {
    outputTarget: "records",
  });
  withStageOptions(wizard, "StoragePrepared", {
    destination: "prepared://warehouse/customers",
  });
  return wizard.exportPipelineState();
}

describe("DataStudioPipelineExecutionService", () => {
  it("blocks launch when pipeline readiness has blocking validation issues", async () => {
    const wizard = new DataStudioPreparationWizard();
    const service = new DataStudioPipelineExecutionService(
      new UnifiedExecutionEngine([new DataStudioPipelineExecutionUnitHandler()]),
    );

    const result = await service.run({
      pipelineState: wizard.exportPipelineState(),
    });
    expect(result.launchStatus).toBe("blocked");
    expect(result.readiness.blockingIssueCount).toBeGreaterThan(0);
    expect(result.execution.launchAccepted).toBeFalse();
  });

  it("executes the canonical data pipeline and emits prepared output integration metadata", async () => {
    const service = new DataStudioPipelineExecutionService(
      new UnifiedExecutionEngine([new DataStudioPipelineExecutionUnitHandler()]),
    );
    const state = createReadyState();

    const result = await service.run({
      pipelineState: state,
      initiatedBy: "test",
      executionReason: "integration-test",
    });

    expect(result.launchStatus).toBe("launched");
    expect(result.execution.launchAccepted).toBeTrue();
    expect(result.execution.runId).toBeDefined();
    expect(result.result?.status).toBe("completed");
    expect(result.result?.preparedOutput?.storageReference).toContain("prepared://");
    expect(result.result?.lineageId).toBeDefined();
  });
});
