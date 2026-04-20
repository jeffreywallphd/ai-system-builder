import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import type { PythonDatasetPreparationPort } from "../ports/runtime";
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
  train?: StagedArtifactDescriptor;
  test?: StagedArtifactDescriptor;
  localOutputs?: {
    train: StagedArtifactDescriptor;
    test: StagedArtifactDescriptor;
  };
  huggingFaceOutputs?: {
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
        const catalogOriginalName = this.artifactCatalog
          ? await this.artifactCatalog.readArtifactCatalogRecord({ storageKey }, context)
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

      const [trainBytes, testBytes] = await Promise.all([
        readFile(trainOutput.tempPath),
        readFile(testOutput.tempPath),
      ]);

      let localOutputs: PrepareTrainingDatasetFromArtifactsValue["localOutputs"];
      if (destinations.local) {
        const [storedTrain, storedTest] = await Promise.all([
          this.storage.storeArtifact(createStoreArtifactRequest(trainBytes, {
            descriptor: {
              mediaType: trainOutput.mediaType,
              metadata: {
                runtimeOutputName: trainOutput.name,
                runtimeRole: "train",
                sourceArtifactIds: command.sourceArtifactIds,
                recipe: command.recipe,
                split: command.split,
                output: command.output,
                generationModelId: command.recipe.generation.model.modelId,
                rowCount: prepared.summary.trainRowCount,
                runtimeOutputMetadata: trainOutput.metadata,
                datasetPreparationStage: "generated-examples",
                destination: "local",
              },
            },
          }), context),
          this.storage.storeArtifact(createStoreArtifactRequest(testBytes, {
            descriptor: {
              mediaType: testOutput.mediaType,
              metadata: {
                runtimeOutputName: testOutput.name,
                runtimeRole: "test",
                sourceArtifactIds: command.sourceArtifactIds,
                recipe: command.recipe,
                split: command.split,
                output: command.output,
                generationModelId: command.recipe.generation.model.modelId,
                rowCount: prepared.summary.testRowCount,
                runtimeOutputMetadata: testOutput.metadata,
                datasetPreparationStage: "generated-examples",
                destination: "local",
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

      let huggingFaceOutputs: PrepareTrainingDatasetFromArtifactsValue["huggingFaceOutputs"];
      if (destinations.huggingFace) {
        if (!this.artifactRepoStorage) {
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
          this.artifactRepoStorage.storeArtifactInRepo(
            createStoreArtifactInRepoRequest(new Uint8Array(trainBytes), {
              target: { ...target, path: trainPath },
              mediaType: trainOutput.mediaType,
              metadata: {
                runtimeRole: "train",
                sourceArtifactIds: command.sourceArtifactIds,
                recipe: command.recipe,
                split: command.split,
                output: command.output,
                generationModelId: command.recipe.generation.model.modelId,
                summary: prepared.summary,
              },
            }),
            context,
          ),
          this.artifactRepoStorage.storeArtifactInRepo(
            createStoreArtifactInRepoRequest(new Uint8Array(testBytes), {
              target: { ...target, path: testPath },
              mediaType: testOutput.mediaType,
              metadata: {
                runtimeRole: "test",
                sourceArtifactIds: command.sourceArtifactIds,
                recipe: command.recipe,
                split: command.split,
                output: command.output,
                generationModelId: command.recipe.generation.model.modelId,
                summary: prepared.summary,
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
          this.artifactRepoStorage.hasArtifactInRepo(createHasArtifactInRepoRequest({ ...target, path: trainPath }), context),
          this.artifactRepoStorage.hasArtifactInRepo(createHasArtifactInRepoRequest({ ...target, path: testPath }), context),
        ]);

        if (!verifyTrain.ok) {
          return createFailureResult(verifyTrain.error, context);
        }
        if (!verifyTest.ok) {
          return createFailureResult(verifyTest.error, context);
        }

        const verifiedAt = this.now();
        huggingFaceOutputs = {
          train: {
            provider: "huggingface",
            repository: target.repository,
            path: trainPath,
            revision: target.revision,
            exists: verifyTrain.value.exists,
            verifiedAt,
          },
          test: {
            provider: "huggingface",
            repository: target.repository,
            path: testPath,
            revision: target.revision,
            exists: verifyTest.value.exists,
            verifiedAt,
          },
        };
      }

      return createSuccessResult({
        train: localOutputs?.train,
        test: localOutputs?.test,
        localOutputs,
        huggingFaceOutputs,
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
