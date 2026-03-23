import { describe, expect, it } from "bun:test";
import { PythonRuntimeDatasetGenerationService } from "../PythonRuntimeDatasetGenerationService";

describe("PythonRuntimeDatasetGenerationService", () => {
  it("maps provider/model-backed runtime generation responses into dataset examples", async () => {
    const service = new PythonRuntimeDatasetGenerationService({
      generateDatasetExamples: async () => ({
        batch_id: "batch-1",
        generated_at: "2025-01-01T00:00:00.000Z",
        generated_count: 1,
        skipped_count: 0,
        examples: [{ question: "Q", answer: "A", context: "C", sourceDocumentId: "doc-1" }],
        provenance: {
          provider: "openai-compatible",
          model_id: "gpt-test",
          model_display_name: "gpt-test",
          generator_id: "provider-generator",
          generator_version: "2.0.0",
          batch_id: "batch-1",
          mode: "provider-model-backed",
          status: "completed",
          detail: "provider result",
          parameters: { strategy: "provider-preferred" },
          started_at: "2025-01-01T00:00:00.000Z",
          executed_at: "2025-01-01T00:00:01.000Z",
          duration_ms: 1000,
          diagnostics: [],
        },
      }),
    } as never);

    const result = await service.generate({
      datasetId: "dataset-1",
      versionId: "version-1",
      taskType: "question_answering",
      createdBy: "tester",
      sourceDocuments: [],
      existingExamples: [],
      configuration: { strategy: "provider-preferred" },
    });

    expect(result.provenance.mode).toBe("provider-model-backed");
    expect(result.provenance.modelId).toBe("gpt-test");
    expect(result.examples[0]?.lineage.generationMethod).toBe("provider-model-backed-generation");
  });
});
