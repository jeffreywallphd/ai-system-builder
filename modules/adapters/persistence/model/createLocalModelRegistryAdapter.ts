import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  normalizeModelInventoryRecord,
  type DeleteModelRecordRequest,
  type DeleteModelRecordResult,
  type ListModelsRequest,
  type ListModelsResult,
  type ModelInventoryRecord,
  type RegisterDownloadedModelRequest,
  type RegisterDownloadedModelResult,
  type RegisterGeneratedModelRequest,
  type RegisterGeneratedModelResult,
  type SaveModelReferenceRequest,
  type SaveModelReferenceResult,
  type UpdateModelRecordRequest,
  type UpdateModelRecordResult,
} from "../../../contracts/model";
import type { ModelRegistryPort } from "../../../application/ports/model";

interface ModelRegistryFileShape {
  models?: ModelInventoryRecord[];
  [key: string]: unknown;
}

export interface LocalModelRegistryAdapterOptions {
  filePath: string;
  now?: () => string;
}

function toTrimmedText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildStableModelRecordId(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `model_${hash}`;
}

export function createLocalModelRegistryAdapter(options: LocalModelRegistryAdapterOptions): ModelRegistryPort {
  const now = options.now ?? (() => new Date().toISOString());

  async function readDocument(): Promise<ModelRegistryFileShape> {
    try {
      const json = await readFile(options.filePath, "utf8");
      const parsed = JSON.parse(json) as ModelRegistryFileShape;
      if (!parsed || typeof parsed !== "object") {
        return { models: [] };
      }

      return {
        ...parsed,
        models: Array.isArray(parsed.models) ? parsed.models : [],
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { models: [] };
      }

      throw error;
    }
  }

  async function writeDocument(document: ModelRegistryFileShape): Promise<void> {
    await mkdir(dirname(options.filePath), { recursive: true });
    const temporaryPath = `${options.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(document, null, 2), "utf8");
    await rename(temporaryPath, options.filePath);
  }

  function matchesFilters(record: ModelInventoryRecord, request: ListModelsRequest): boolean {
    if (request.source && record.source !== request.source) {
      return false;
    }

    if (request.lifecycleStatus && record.lifecycleStatus !== request.lifecycleStatus) {
      return false;
    }

    if (request.artifactForm && record.artifactForm !== request.artifactForm) {
      return false;
    }

    if (request.provider && record.provider !== request.provider) {
      return false;
    }

    if (request.taskTags && request.taskTags.length > 0) {
      const currentTags = new Set(record.taskTags ?? []);
      if (!request.taskTags.every((taskTag) => currentTags.has(taskTag))) {
        return false;
      }
    }

    const search = toTrimmedText(request.search)?.toLowerCase();
    if (search) {
      const haystack = `${record.displayName} ${record.modelId ?? ""} ${record.modelRecordId}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  }

  async function updateDocument(update: (document: ModelRegistryFileShape) => ModelRegistryFileShape): Promise<ModelRegistryFileShape> {
    const current = await readDocument();
    const next = update(current);
    await writeDocument(next);
    return next;
  }

  return {
    async listModels(request: ListModelsRequest): Promise<ListModelsResult> {
      const document = await readDocument();
      const limit = request.limit ?? 50;
      const filtered = (document.models ?? []).map(normalizeModelInventoryRecord).filter((model) => matchesFilters(model, request));
      return {
        models: filtered.slice(0, limit),
        nextCursor: filtered.length > limit ? filtered[limit]?.modelRecordId : undefined,
      };
    },

    async getModelRecord(modelRecordId: string): Promise<ModelInventoryRecord | undefined> {
      const document = await readDocument();
      return (document.models ?? []).map(normalizeModelInventoryRecord).find((record) => record.modelRecordId === modelRecordId);
    },

    async saveModelReference(request: SaveModelReferenceRequest): Promise<SaveModelReferenceResult> {
      const timestamp = now();
      const modelRecordId = request.modelRecordId
        ?? buildStableModelRecordId(`save:${request.provider}:${request.modelId}:${request.displayName ?? ""}`);
      const record = normalizeModelInventoryRecord({
        modelRecordId,
        displayName: request.displayName?.trim() || request.modelId,
        source: "huggingface",
        lifecycleStatus: "saved-reference",
        artifactForm: request.artifactForm ?? "full-model",
        provider: request.provider,
        modelId: request.modelId,
        inferenceMode: request.inferenceMode,
        taskTags: request.taskTags,
        createdAt: timestamp,
        metadata: request.metadata,
      });

      await updateDocument((document) => ({
        ...document,
        models: [...(document.models ?? []).filter((model) => model.modelRecordId !== record.modelRecordId), record],
      }));

      return { model: record };
    },

    async registerDownloadedModel(request: RegisterDownloadedModelRequest): Promise<RegisterDownloadedModelResult> {
      const timestamp = now();
      const modelRecordId = request.modelRecordId
        ?? buildStableModelRecordId(`downloaded:${request.provider}:${request.modelId ?? request.localPath ?? request.displayName}`);
      const record = normalizeModelInventoryRecord({
        modelRecordId,
        displayName: request.displayName,
        source: request.source,
        lifecycleStatus: "downloaded",
        artifactForm: request.artifactForm,
        provider: request.provider,
        modelId: request.modelId,
        localPath: request.localPath,
        backingArtifactIds: request.backingArtifactIds,
        primaryArtifactId: request.primaryArtifactId,
        inferenceMode: request.inferenceMode,
        taskTags: request.taskTags,
        baseModelId: request.baseModelId,
        adapterOfModelId: request.adapterOfModelId,
        serializationFormat: request.serializationFormat as ModelInventoryRecord["serializationFormat"],
        sizeBytes: request.sizeBytes,
        createdAt: timestamp,
        metadata: request.metadata,
      });

      await updateDocument((document) => ({
        ...document,
        models: [...(document.models ?? []).filter((model) => model.modelRecordId !== record.modelRecordId), record],
      }));
      return { model: record };
    },

    async registerGeneratedModel(request: RegisterGeneratedModelRequest): Promise<RegisterGeneratedModelResult> {
      const timestamp = now();
      const modelRecordId = request.modelRecordId
        ?? buildStableModelRecordId(`generated:${request.generatedFromRunId ?? "no-run"}:${request.displayName}:${request.modelId ?? ""}`);
      const record = normalizeModelInventoryRecord({
        modelRecordId,
        displayName: request.displayName,
        source: "generated",
        lifecycleStatus: "generated",
        artifactForm: request.artifactForm,
        provider: request.provider ?? "unknown",
        modelId: request.modelId,
        localPath: request.localPath,
        backingArtifactIds: request.backingArtifactIds,
        primaryArtifactId: request.primaryArtifactId,
        inferenceMode: request.inferenceMode,
        taskTags: request.taskTags,
        baseModelId: request.baseModelId,
        adapterOfModelId: request.adapterOfModelId,
        generatedFromRunId: request.generatedFromRunId,
        serializationFormat: request.serializationFormat as ModelInventoryRecord["serializationFormat"],
        sizeBytes: request.sizeBytes,
        createdAt: timestamp,
        metadata: request.metadata,
      });

      await updateDocument((document) => ({
        ...document,
        models: [...(document.models ?? []).filter((model) => model.modelRecordId !== record.modelRecordId), record],
      }));
      return { model: record };
    },

    async updateModelRecord(request: UpdateModelRecordRequest): Promise<UpdateModelRecordResult> {
      let updated: ModelInventoryRecord | undefined;
      await updateDocument((document) => {
        const models = (document.models ?? []).map((candidate) => {
          const normalized = normalizeModelInventoryRecord(candidate);
          if (normalized.modelRecordId !== request.modelRecordId) {
            return normalized;
          }

          updated = normalizeModelInventoryRecord({
            ...normalized,
            ...request.patch,
            modelRecordId: normalized.modelRecordId,
            createdAt: normalized.createdAt,
            updatedAt: now(),
          });
          return updated;
        });

        return { ...document, models };
      });

      if (!updated) {
        throw new Error(`Model record ${request.modelRecordId} was not found.`);
      }

      return { model: updated };
    },

    async deleteModelRecord(request: DeleteModelRecordRequest): Promise<DeleteModelRecordResult> {
      let deleted = false;
      await updateDocument((document) => {
        const models = (document.models ?? []).filter((candidate) => {
          const keep = candidate.modelRecordId !== request.modelRecordId;
          if (!keep) {
            deleted = true;
          }
          return keep;
        });

        return { ...document, models };
      });

      if (!deleted) {
        throw new Error(`Model record ${request.modelRecordId} was not found.`);
      }

      return {
        deletedModelRecordId: request.modelRecordId,
        deletedRegistryRecord: true,
        deletedLocalFiles: false,
        deletedBackingArtifactIds: [],
      };
    },
  };
}
