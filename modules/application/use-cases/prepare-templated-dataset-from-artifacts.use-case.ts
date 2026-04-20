import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createStagedArtifactDescriptorFromStorageObjectDescriptor,
  type StagedArtifactDescriptor,
} from "../../contracts/ingestion";
import { createContractError, createFailureResult, createSuccessResult, type ContractResult } from "../../contracts/shared";
import { createRetrieveArtifactRequest, createStoreArtifactRequest } from "../../contracts/storage";
import type { PrepareTemplatedDatasetRequest } from "../../contracts/runtime";

import type { ApplicationRequestContext } from "../ports";
import type { PythonDatasetPreparationPort } from "../ports/runtime";
import type { ArtifactStorageBindingPort, ArtifactObjectStoragePort } from "../ports/storage";
import type { ArtifactStorageBinding } from "../../contracts/storage";

export interface PrepareTemplatedDatasetFromArtifactsCommand {
  sourceArtifactIds: string[];
  template: string;
  split: {
    trainRatio: number;
    testRatio: number;
    seed?: number;
  };
  outputFormat: "jsonl" | "json" | "csv";
  shuffle?: boolean;
  validationPolicy?: "strict" | "best-effort";
  outputNaming?: {
    baseName?: string;
  };
}

export interface PrepareTemplatedDatasetFromArtifactsValue {
  train: StagedArtifactDescriptor;
  test: StagedArtifactDescriptor;
  trainRowCount: number;
  testRowCount: number;
  warnings?: string[];
}

export type PrepareTemplatedDatasetFromArtifactsResult = ContractResult<PrepareTemplatedDatasetFromArtifactsValue>;

export interface PrepareTemplatedDatasetFromArtifactsUseCaseDependencies {
  datasetPreparation: PythonDatasetPreparationPort;
  storageBindings: ArtifactStorageBindingPort;
  storage: ArtifactObjectStoragePort;
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

export class PrepareTemplatedDatasetFromArtifactsUseCase {
  private readonly datasetPreparation: PythonDatasetPreparationPort;
  private readonly storageBindings: ArtifactStorageBindingPort;
  private readonly storage: ArtifactObjectStoragePort;

  public constructor(dependencies: PrepareTemplatedDatasetFromArtifactsUseCaseDependencies) {
    this.datasetPreparation = dependencies.datasetPreparation;
    this.storageBindings = dependencies.storageBindings;
    this.storage = dependencies.storage;
  }

  public async execute(
    command: PrepareTemplatedDatasetFromArtifactsCommand,
    context?: ApplicationRequestContext,
  ): Promise<PrepareTemplatedDatasetFromArtifactsResult> {
    const runtimeWorkingDir = await mkdtemp(join(tmpdir(), "ai-system-builder-runtime-"));

    try {
      const runtimeRequest: PrepareTemplatedDatasetRequest = {
        sourceInputs: [],
        template: command.template,
        split: command.split,
        outputFormat: command.outputFormat,
        shuffle: command.shuffle,
        validationPolicy: command.validationPolicy,
        outputNaming: command.outputNaming,
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

        runtimeRequest.sourceInputs.push({
          artifactId,
          localPath,
          mediaType,
        });
      }

      const prepared = await this.datasetPreparation.prepareTemplatedDataset(runtimeRequest);
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

      const [storedTrain, storedTest] = await Promise.all([
        this.storage.storeArtifact(createStoreArtifactRequest(trainBytes, {
          descriptor: {
            mediaType: trainOutput.mediaType,
            metadata: {
              runtimeOutputName: trainOutput.name,
              runtimeRole: "train",
              sourceArtifactIds: command.sourceArtifactIds,
              template: command.template,
              split: command.split,
              outputFormat: command.outputFormat,
              shuffle: command.shuffle ?? false,
              rowCount: prepared.trainRowCount,
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
              template: command.template,
              split: command.split,
              outputFormat: command.outputFormat,
              shuffle: command.shuffle ?? false,
              rowCount: prepared.testRowCount,
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

      return createSuccessResult({
        train: createStagedArtifactDescriptorFromStorageObjectDescriptor(storedTrain.value, {
          sourceKind: "runtime",
          originalName: `${trainOutput.name}.${command.outputFormat}`,
        }),
        test: createStagedArtifactDescriptorFromStorageObjectDescriptor(storedTest.value, {
          sourceKind: "runtime",
          originalName: `${testOutput.name}.${command.outputFormat}`,
        }),
        trainRowCount: prepared.trainRowCount,
        testRowCount: prepared.testRowCount,
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
