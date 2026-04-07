import { ChatCompletionExample, ExampleLineage, QuestionAnsweringExample } from "@domain/tuning-datasets/TuningDatasetEntities";
import type { DatasetExample, DatasetGenerationRequest, DatasetGenerationResult, DatasetGenerationService } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { IPythonRuntimeClient } from "@application/ports/interfaces/IPythonRuntimeClient";

export class PythonRuntimeDatasetGenerationService implements DatasetGenerationService {
  constructor(private readonly client: IPythonRuntimeClient) {}

  public async generate(request: DatasetGenerationRequest): Promise<DatasetGenerationResult> {
    const response = await this.client.generateDatasetExamples({
      dataset_id: request.datasetId,
      version_id: request.versionId,
      task_type: request.taskType,
      created_by: request.createdBy,
      source_documents: request.sourceDocuments.map((document) => ({
        id: document.id,
        name: document.name,
        content: document.content,
        segments: document.segments.map((segment) => ({
          id: segment.id,
          index: segment.index,
          kind: segment.kind,
          text: segment.text,
        })),
      })),
      existing_examples: request.existingExamples.map((example) => ({ id: example.id, taskType: example.taskType })),
      configuration: request.configuration
        ? {
            strategy: request.configuration.strategy,
            max_examples_per_source: request.configuration.maxExamplesPerSource,
            max_segments_per_source: request.configuration.maxSegmentsPerSource,
            provider: request.configuration.provider,
            model: request.configuration.model,
          }
        : undefined,
    });

    const examples = Object.freeze(response.examples.map((example, index) => toDomainExample(request, response.batch_id, response.provenance.mode, example, index)));

    return Object.freeze({
      batchId: response.batch_id,
      datasetId: request.datasetId,
      versionId: request.versionId,
      taskType: request.taskType,
      generatedAt: new Date(response.generated_at),
      examples,
      provenance: Object.freeze({
        provider: response.provenance.provider,
        modelId: response.provenance.model_id,
        modelDisplayName: response.provenance.model_display_name,
        generatorId: response.provenance.generator_id,
        generatorVersion: response.provenance.generator_version,
        batchId: response.provenance.batch_id,
        mode: response.provenance.mode,
        executionKind: response.provenance.execution_kind,
        status: response.provenance.status,
        path: response.provenance.path,
        isFallback: response.provenance.is_fallback,
        isDegraded: response.provenance.is_degraded,
        detail: response.provenance.detail,
        parameters: response.provenance.parameters,
        startedAt: new Date(response.provenance.started_at),
        executedAt: new Date(response.provenance.executed_at),
        durationMs: response.provenance.duration_ms,
        diagnostics: Object.freeze(response.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
        fallbackReason: response.provenance.fallback_reason,
        fallback: response.provenance.fallback ? Object.freeze({ ...response.provenance.fallback }) : undefined,
      }),
      generatedCount: response.generated_count,
      skippedCount: response.skipped_count,
      status: response.provenance.status,
    });
  }
}

function toDomainExample(
  request: DatasetGenerationRequest,
  batchId: string,
  generationMode: DatasetGenerationResult["provenance"]["mode"],
  example: Readonly<Record<string, unknown>>,
  index: number,
): DatasetExample {
  const lineage = new ExampleLineage({
    sourceDocumentId: typeof example.sourceDocumentId === "string" ? example.sourceDocumentId : undefined,
    generationMethod: generationMode === "provider-model-backed"
      ? "provider-model-backed-generation"
      : generationMode === "python-runtime-local"
        ? "python-runtime-local-generation"
        : "heuristic-fallback-generation",
    capturedAt: new Date(),
    metadata: Object.freeze({
      ...(typeof example.lineageMetadata === "object" && example.lineageMetadata ? example.lineageMetadata as Record<string, unknown> : {}),
      batchId,
      generationMode,
    }),
  });

  if (request.taskType === "question_answering") {
    return new QuestionAnsweringExample({
      id: `qa_example_${batchId}_${index + 1}`,
      datasetId: request.datasetId,
      versionId: request.versionId,
      question: String(example.question ?? ""),
      answer: String(example.answer ?? ""),
      context: String(example.context ?? ""),
      sourceDocumentId: typeof example.sourceDocumentId === "string" ? example.sourceDocumentId : undefined,
      sourceMetadata: typeof example.sourceMetadata === "object" && example.sourceMetadata ? example.sourceMetadata as Record<string, unknown> : undefined,
      createdBy: request.createdBy,
      lineage,
    });
  }

  const messages = Array.isArray(example.messages)
    ? example.messages.map((message) => Object.freeze({
        role: String((message as Record<string, unknown>).role ?? "user") as "system" | "user" | "assistant",
        content: String((message as Record<string, unknown>).content ?? ""),
      }))
    : [];

  return new ChatCompletionExample({
    id: `chat_example_${batchId}_${index + 1}`,
    datasetId: request.datasetId,
    versionId: request.versionId,
    messages,
    createdBy: request.createdBy,
    lineage,
  });
}

