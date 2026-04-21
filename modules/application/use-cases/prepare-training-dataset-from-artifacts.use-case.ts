import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createStagedArtifactDescriptorFromStorageObjectDescriptor,
  type StagedArtifactDescriptor,
} from "../../contracts/ingestion";
import { createContractError, createFailureResult, createSuccessResult, type ContractResult } from "../../contracts/shared";
import {
  createHasArtifactInRepoRequest,
  createRetrieveArtifactRequest,
  createStoreArtifactInRepoRequest,
  createStoreArtifactRequest,
} from "../../contracts/storage";
import type {
  DatasetPreparationSummary,
  DatasetPreparationWarning,
  PrepareTrainingDatasetRequest,
} from "../../contracts/runtime";

import type { ApplicationRequestContext } from "../ports";
import { PythonDatasetPreparationError, type PythonDatasetPreparationPort } from "../ports/runtime";
import type { ArtifactCatalogReadPort } from "../ports/artifact-catalog";
import type { ArtifactStorageBindingPort, ArtifactObjectStoragePort, ArtifactRepoStoragePort } from "../ports/storage";
import type { ArtifactStorageBinding } from "../../contracts/storage";

export interface PrepareTrainingDatasetFromArtifactsCommand {
  sourceArtifactIds: string[];
  recipe: PrepareTrainingDatasetRequest["recipe"];
  split: PrepareTrainingDatasetRequest["split"];
  output: PrepareTrainingDatasetRequest["output"];
}

export interface PrepareTrainingDatasetFromArtifactsValue {
  outputs: {
    local?: {
      train: StagedArtifactDescriptor;
      test: StagedArtifactDescriptor;
    };
    huggingFace?: {
      train: {
        provider: "huggingface";
        repository: string;
        path: string;
        revision?: string;
        exists: boolean;
        verifiedAt: string;
      };
      test: {
        provider: "huggingface";
        repository: string;
        path: string;
        revision?: string;
        exists: boolean;
        verifiedAt: string;
      };
    };
  };
  provenance: {
    sourceArtifactIds: string[];
    recipe: PrepareTrainingDatasetRequest["recipe"];
    split: PrepareTrainingDatasetRequest["split"];
    output: PrepareTrainingDatasetRequest["output"];
    generationModelId: string;
    summary: DatasetPreparationSummary;
  };
  summary: DatasetPreparationSummary;
  warnings?: DatasetPreparationWarning[];
}

export type PrepareTrainingDatasetFromArtifactsResult = ContractResult<PrepareTrainingDatasetFromArtifactsValue>;

export interface PrepareTrainingDatasetFromArtifactsUseCaseDependencies {
  datasetPreparation: PythonDatasetPreparationPort;
  storageBindings: ArtifactStorageBindingPort;
  storage: ArtifactObjectStoragePort;
  artifactRepoStorage?: ArtifactRepoStoragePort;
  artifactCatalog?: ArtifactCatalogReadPort;
  now?: () => string;
}

function resolvePreferredObjectStorageBinding(
  bindings: ArtifactStorageBinding[],
): ArtifactStorageBinding | undefined {
  // Dataset preparation requires locally retrievable object bytes.
  // Prefer an artifact-object + local + primary binding when available, then
  // fallback to any artifact-object binding, then the first entry as a last resort.
  return bindings.find((binding) =>
    binding.backing.kind === "artifact-object"
    && binding.backing.provider === "local"
    && binding.role === "primary")
    ?? bindings.find((binding) => binding.backing.kind === "artifact-object")
    ?? bindings[0];
}

function extensionForMediaType(mediaType: string): string {
  if (mediaType === "application/x-ndjson" || mediaType === "application/jsonl") {
    return ".jsonl";
  }

  if (mediaType === "application/json" || mediaType === "text/json") {
    return ".json";
  }

  if (mediaType === "text/csv" || mediaType === "application/csv") {
    return ".csv";
  }

  return ".txt";
}

interface ResolvedOutputDestinations {
  local: boolean;
  huggingFace?: {
    provider: "huggingface";
    repository: string;
    revision?: string;
    pathPrefix?: string;
  };
}

function resolveOutputDestinations(
  output: PrepareTrainingDatasetRequest["output"],
): ResolvedOutputDestinations {
  const localEnabled = output.destinations?.local?.enabled ?? true;
  const huggingFace = output.destinations?.huggingFace;

  if (!localEnabled && !huggingFace?.enabled) {
    throw new Error("At least one dataset output destination must be enabled.");
  }

  if (!huggingFace?.enabled) {
    return { local: localEnabled };
  }

  return {
    local: localEnabled,
    huggingFace: {
      provider: "huggingface",
      repository: huggingFace.repository,
      revision: huggingFace.revision,
      pathPrefix: huggingFace.pathPrefix,
    },
  };
}

function joinRepoPath(pathPrefix: string | undefined, fileName: string): string {
  const normalizedPrefix = pathPrefix?.trim().replace(/^\/+|\/+$/g, "");
  return normalizedPrefix ? `${normalizedPrefix}/${fileName}` : fileName;
}

function buildDatasetMetadata(
  command: PrepareTrainingDatasetFromArtifactsCommand,
  summary: DatasetPreparationSummary,
  destination: {
    provider: "local" | "huggingface";
    publication?: {
      repository: string;
      path: string;
      revision?: string;
    };
  },
  runtimeMetadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    sourceArtifactIds: command.sourceArtifactIds,
    recipe: command.recipe,
    split: command.split,
    generationModel: {
      provider: command.recipe.generation.model.provider,
      modelId: command.recipe.generation.model.modelId,
    },
    summary,
    destination,
    runtime: runtimeMetadata,
  };
}

async function validateDatasetOutput(tempPath: string, format: PrepareTrainingDatasetRequest["output"]["format"]): Promise<void> {
  const outputStat = await stat(tempPath);
  if (outputStat.size <= 0) {
    throw new Error(`Runtime output file '${tempPath}' is empty.`);
  }

  const contents = await readFile(tempPath, "utf-8");
  if (!contents.trim()) {
    throw new Error(`Runtime output file '${tempPath}' contains no data.`);
  }

  if (format === "json") {
    JSON.parse(contents);
    return;
  }

  if (format === "jsonl") {
    const lines = contents.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new Error(`Runtime output file '${tempPath}' does not contain any JSONL rows.`);
    }
    for (const line of lines) {
      JSON.parse(line);
    }
    return;
  }

  const [header] = contents.split(/\r?\n/);
  if (!header || header.trim().length === 0) {
    throw new Error(`Runtime output file '${tempPath}' does not include a CSV header.`);
  }
}

export class PrepareTrainingDatasetFromArtifactsUseCase {
  private readonly datasetPreparation: PythonDatasetPreparationPort;
  private readonly storageBindings: ArtifactStorageBindingPort;
  private readonly storage: ArtifactObjectStoragePort;
  private readonly artifactRepoStorage?: ArtifactRepoStoragePort;
  private readonly artifactCatalog?: ArtifactCatalogReadPort;
  private readonly now: () => string;

  public constructor(dependencies: PrepareTrainingDatasetFromArtifactsUseCaseDependencies) {
    this.datasetPreparation = dependencies.datasetPreparation;
    this.storageBindings = dependencies.storageBindings;
    this.storage = dependencies.storage;
    this.artifactRepoStorage = dependencies.artifactRepoStorage;
    this.artifactCatalog = dependencies.artifactCatalog;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async execute(
    command: PrepareTrainingDatasetFromArtifactsCommand,
    context?: ApplicationRequestContext,
  ): Promise<PrepareTrainingDatasetFromArtifactsResult> {
    const runtimeWorkingDir = await mkdtemp(join(tmpdir(), "ai-system-builder-runtime-"));

    try {
      const destinations = resolveOutputDestinations(command.output);
      const runtimeRequest: PrepareTrainingDatasetRequest = {
        sourceInputs: [],
        recipe: command.recipe,
        split: command.split,
        output: command.output,
      };

      for (const artifactId of command.sourceArtifactIds) {
        const bindingsResult = await this.storageBindings.readArtifactStorageBindings({ artifactId }, context);
        if (!bindingsResult.ok || bindingsResult.value.bindings.length === 0) {
          return createFailureResult(
            createContractError("not-found", `No storage binding found for artifact '${artifactId}'.`),
            context,
          );
        }

        const preferredBinding = resolvePreferredObjectStorageBinding(bindingsResult.value.bindings);
        const storageKey = preferredBinding?.backing.locator;
        if (!storageKey) {
          return createFailureResult(
            createContractError("not-found", `Storage locator missing for artifact '${artifactId}'.`),
            context,
          );
        }

        const retrieveResult = await this.storage.retrieveArtifact(createRetrieveArtifactRequest(storageKey), context);
        if (!retrieveResult.ok) {
          return createFailureResult(retrieveResult.error, context);
        }

        const mediaType = retrieveResult.value.descriptor.mediaType ?? "application/json";
        const localPath = join(runtimeWorkingDir, `${artifactId}${extensionForMediaType(mediaType)}`);
        await writeFile(localPath, Buffer.from(retrieveResult.value.content as Uint8Array));

        const descriptorMetadata = retrieveResult.value.descriptor.metadata;
        const metadataOriginalName = descriptorMetadata
          && typeof descriptorMetadata === "object"
          && !Array.isArray(descriptorMetadata)
          && typeof (descriptorMetadata as { originalName?: unknown }).originalName === "string"
          ? (descriptorMetadata as { originalName: string }).originalName
          : undefined;
        const artifactCatalog = this.artifactCatalog;
        const catalogOriginalName = artifactCatalog
          ? await artifactCatalog.readArtifactCatalogRecord({ storageKey }, context)
            .then((result) => (result.ok ? result.value.record.originalName : undefined))
          : undefined;

        runtimeRequest.sourceInputs.push({
          artifactId,
          localPath,
          mediaType,
          originalName: metadataOriginalName ?? catalogOriginalName,
        });
      }

      const prepared = await this.datasetPreparation.prepareTrainingDataset(runtimeRequest);
      const trainOutput = prepared.outputs.find((output) => output.role === "train");
      const testOutput = prepared.outputs.find((output) => output.role === "test");

      if (!trainOutput || !testOutput) {
        return createFailureResult(
          createContractError("internal", "Runtime did not return both train and test outputs."),
          context,
        );
      }

      let trainBytes: Buffer;
      let testBytes: Buffer;
      try {
        await Promise.all([
          validateDatasetOutput(trainOutput.tempPath, command.output.format),
          validateDatasetOutput(testOutput.tempPath, command.output.format),
        ]);
        [trainBytes, testBytes] = await Promise.all([
          readFile(trainOutput.tempPath),
          readFile(testOutput.tempPath),
        ]);
      } finally {
        await Promise.allSettled([
          rm(trainOutput.tempPath, { force: true }),
          rm(testOutput.tempPath, { force: true }),
        ]);
      }

      let localOutputs: PrepareTrainingDatasetFromArtifactsValue["outputs"]["local"];
      if (destinations.local) {
        const [storedTrain, storedTest] = await Promise.all([
          this.storage.storeArtifact(createStoreArtifactRequest(trainBytes, {
            descriptor: {
              mediaType: trainOutput.mediaType,
              metadata: {
                runtimeRole: "train",
                ...buildDatasetMetadata(command, prepared.summary, { provider: "local" }, trainOutput.metadata),
              },
            },
          }), context),
          this.storage.storeArtifact(createStoreArtifactRequest(testBytes, {
            descriptor: {
              mediaType: testOutput.mediaType,
              metadata: {
                runtimeRole: "test",
                ...buildDatasetMetadata(command, prepared.summary, { provider: "local" }, testOutput.metadata),
              },
            },
          }), context),
        ]);

        if (!storedTrain.ok) {
          return createFailureResult(storedTrain.error, context);
        }

        if (!storedTest.ok) {
          return createFailureResult(storedTest.error, context);
        }

        localOutputs = {
          train: createStagedArtifactDescriptorFromStorageObjectDescriptor(storedTrain.value, {
            sourceKind: "runtime",
            originalName: `${trainOutput.name}.${command.output.format}`,
          }),
          test: createStagedArtifactDescriptorFromStorageObjectDescriptor(storedTest.value, {
            sourceKind: "runtime",
            originalName: `${testOutput.name}.${command.output.format}`,
          }),
        };
      }

      let huggingFaceOutputs: PrepareTrainingDatasetFromArtifactsValue["outputs"]["huggingFace"];
      if (destinations.huggingFace) {
        const artifactRepoStorage = this.artifactRepoStorage;
        if (!artifactRepoStorage) {
          return createFailureResult(
            createContractError("internal", "Artifact repo storage is required for Hugging Face output."),
            context,
          );
        }

        const trainPath = joinRepoPath(
          destinations.huggingFace.pathPrefix,
          `${trainOutput.name}.${command.output.format}`,
        );
        const testPath = joinRepoPath(
          destinations.huggingFace.pathPrefix,
          `${testOutput.name}.${command.output.format}`,
        );
        const target = {
          provider: destinations.huggingFace.provider,
          repository: destinations.huggingFace.repository,
          revision: destinations.huggingFace.revision,
        };

        const [publishTrain, publishTest] = await Promise.all([
          artifactRepoStorage.storeArtifactInRepo(
            createStoreArtifactInRepoRequest(new Uint8Array(trainBytes), {
              target: { ...target, path: trainPath },
              mediaType: trainOutput.mediaType,
              metadata: {
                runtimeRole: "train",
                ...buildDatasetMetadata(command, prepared.summary, {
                  provider: "huggingface",
                  publication: {
                    repository: target.repository,
                    path: trainPath,
                    revision: target.revision,
                  },
                }, trainOutput.metadata),
              },
            }),
            context,
          ),
          artifactRepoStorage.storeArtifactInRepo(
            createStoreArtifactInRepoRequest(new Uint8Array(testBytes), {
              target: { ...target, path: testPath },
              mediaType: testOutput.mediaType,
              metadata: {
                runtimeRole: "test",
                ...buildDatasetMetadata(command, prepared.summary, {
                  provider: "huggingface",
                  publication: {
                    repository: target.repository,
                    path: testPath,
                    revision: target.revision,
                  },
                }, testOutput.metadata),
              },
            }),
            context,
          ),
        ]);

        if (!publishTrain.ok) {
          return createFailureResult(publishTrain.error, context);
        }
        if (!publishTest.ok) {
          return createFailureResult(publishTest.error, context);
        }

        const [verifyTrain, verifyTest] = await Promise.all([
          artifactRepoStorage.hasArtifactInRepo(createHasArtifactInRepoRequest({ ...target, path: trainPath }), context),
          artifactRepoStorage.hasArtifactInRepo(createHasArtifactInRepoRequest({ ...target, path: testPath }), context),
        ]);

        if (!verifyTrain.ok) {
          return createFailureResult(verifyTrain.error, context);
        }
        if (!verifyTest.ok) {
          return createFailureResult(verifyTest.error, context);
        }

        const verifiedAt = this.now();
        const publishTrainTarget = publishTrain.value.descriptor.target;
        const publishTestTarget = publishTest.value.descriptor.target;
        huggingFaceOutputs = {
          train: {
            provider: "huggingface",
            repository: publishTrainTarget.repository,
            path: publishTrainTarget.path ?? trainPath,
            revision: publishTrainTarget.revision,
            exists: verifyTrain.value.exists,
            verifiedAt,
          },
          test: {
            provider: "huggingface",
            repository: publishTestTarget.repository,
            path: publishTestTarget.path ?? testPath,
            revision: publishTestTarget.revision,
            exists: verifyTest.value.exists,
            verifiedAt,
          },
        };
      }

      return createSuccessResult({
        outputs: {
          local: localOutputs,
          huggingFace: huggingFaceOutputs,
        },
        provenance: {
          sourceArtifactIds: command.sourceArtifactIds,
          recipe: command.recipe,
          split: command.split,
          output: command.output,
          generationModelId: command.recipe.generation.model.modelId,
          summary: prepared.summary,
        },
        summary: prepared.summary,
        warnings: prepared.warnings,
      }, context);
    } catch (error) {
      if (error instanceof PythonDatasetPreparationError) {
        return createFailureResult(error.contractError, context);
      }
      return createFailureResult(
        createContractError(
          "internal",
          error instanceof Error ? error.message : "Dataset preparation failed unexpectedly.",
        ),
        context,
      );
    } finally {
      await rm(runtimeWorkingDir, { recursive: true, force: true });
    }
  }
}
