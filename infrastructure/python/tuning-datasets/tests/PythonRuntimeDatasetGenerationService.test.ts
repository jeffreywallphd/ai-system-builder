import { describe, expect, it } from "bun:test";
import { PythonRuntimeDatasetGenerationService } from "../PythonRuntimeDatasetGenerationService";

describe("PythonRuntimeDatasetGenerationService", () => {
  it("maps provider-backed runtime generation responses into dataset examples", async () => {
    const service = new PythonRuntimeDatasetGenerationService({
      generateDatasetExamples: async () => ({
        batch_id: "batch-1",
        generated_at: "2025-01-01T00:00:00.000Z",
        generated_count: 1,
        skipped_count: 0,
        examples: [{ question: "Q?", answer: "A", context: "Ctx", sourceDocumentId: "doc-1", sourceMetadata: { sourceName: "Doc" }, lineageMetadata: { batchId: "batch-1" } }],
        provenance: {
          provider: "python-runtime",
          generator_id: "qa-generator",
          generator_version: "1.0.0",
          batch_id: "batch-1",
          mode: "provider-backed",
          detail: "Provider-backed generation",
          parameters: { strategy: "provider-backed-default" },
          executed_at: "2025-01-01T00:00:00.000Z",
          diagnostics: [],
        },
      }),
    } as any);

    const result = await service.generate({
      datasetId: "dataset-1",
      versionId: "version-1",
      taskType: "question_answering",
      createdBy: "tester",
      sourceDocuments: [{ id: "doc-1", datasetId: "dataset-1", versionId: "version-1", name: "Doc", content: "Context text", sourceType: "manual_text", mediaType: "text/plain", metadata: {}, checksum: "x", createdBy: "tester", createdAt: new Date(), updatedAt: new Date(), segments: [] }],
      existingExamples: [],
      configuration: { strategy: "provider-backed-default" },
    });

    expect(result.provenance.mode).toBe("provider-backed");
    expect(result.examples).toHaveLength(1);
    expect(result.examples[0]?.lineage.metadata?.batchId).toBe("batch-1");
  });
});
