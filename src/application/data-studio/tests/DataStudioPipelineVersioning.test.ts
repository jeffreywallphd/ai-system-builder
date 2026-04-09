import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizard } from "../DataStudioPreparationWizard";
import {
  createDataStudioPipelineVersionMetadata,
  parseDataStudioPipelineVersionMetadata,
} from "../DataStudioPipelineVersioning";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";

describe("DataStudioPipelineVersioning", () => {
  it("creates inspectable version metadata with a canonical serialized pipeline payload", () => {
    const wizard = new DataStudioPreparationWizard();
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    wizard.goNext();

    const metadata = createDataStudioPipelineVersionMetadata(wizard.exportPipelineState());
    expect(metadata.summary.kind).toBe("data-studio-pipeline-version");
    expect(metadata.summary.pipelineRevision).toBeGreaterThan(0);
    expect(metadata.summary.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(metadata.serializedPipelineState).toContain("\"kind\": \"data-studio-pipeline-state\"");
  });

  it("parses valid version metadata and rejects unsupported metadata shapes", () => {
    const wizard = new DataStudioPreparationWizard();
    const envelope = createDataStudioPipelineVersionMetadata(wizard.exportPipelineState());
    const parsed = parseDataStudioPipelineVersionMetadata(envelope);
    expect(parsed?.summary.pipelineId).toBe(envelope.summary.pipelineId);
    expect(parsed?.summary.currentStageId).toBe(envelope.summary.currentStageId);

    expect(parseDataStudioPipelineVersionMetadata(undefined)).toBeUndefined();
    expect(parseDataStudioPipelineVersionMetadata({ kind: "unsupported" })).toBeUndefined();
  });
});
