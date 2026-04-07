import { Model, ModelArtifact, ModelSource } from "../../domain/models/Model";
import {
  ModelCreationCapabilityPolicy,
  type ModelCreationRecommendedAction,
  type ModelCreationSupportState,
} from "../../domain/model-training/ModelCreationSupport";
import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IModelTrainingJobRepository } from "../ports/interfaces/IModelTrainingJobRepository";
import type { IModelTrainingRuntime } from "../ports/interfaces/IModelTrainingRuntime";
import type { IModelCreationEnvironmentGateway } from "../ports/interfaces/IModelCreationEnvironmentGateway";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";
import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import type { DatasetRepository, DatasetVersionRepository, DatasetTaskType } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { ChatCompletionExample, QuestionAnsweringExample } from "../../domain/tuning-datasets/TuningDatasetEntities";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { ModelTrainingArtifact, ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import type { ModelTrainingApplicationService } from "./ModelTrainingApplicationService";
import {
  createModelPreparationExecutionPlan,
  requireModelPreparationJob,
} from "../execution/ModelPreparationExecutionPlanFactory";
import {
  createModelPreparationAndTrainingExecutionPlan,
  requireModelPreparationAndTrainingArtifacts,
  requireModelPreparationAndTrainingJob,
  requireModelPreparationAndTrainingResult,
} from "../execution/ModelPreparationAndTrainingExecutionPlanFactory";
import { getModelTrainingJobFromEvent } from "../execution/ModelTrainingExecutionAdapter";
import type {
  GetModelTrainingStudioSummaryQuery,
  ModelTrainingDatasetVersionOption,
  ModelTrainingJobStudioSummary,
  ModelTrainingPromotionSummary,
  ModelTrainingReadinessCheck,
  ModelTrainingStudioAction,
  ModelTrainingStudioSummary,
  PromoteModelTrainingJobCommand,
  PromoteModelTrainingJobResult,
  SubmitModelTrainingJobCommand,
} from "./contracts";

function defaultCreateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `training_job_${crypto.randomUUID()}`;
  }

  return `training_job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const SUPPORTED_LOCAL_TRAINING_TASK_TYPES = new Set<DatasetTaskType>([
  "question_answering",
  "chat_completion",
]);

export class DefaultModelTrainingApplicationService implements ModelTrainingApplicationService {
  private readonly capabilityPolicy: ModelCreationCapabilityPolicy;

  constructor(
    private readonly installedModelCatalog: IInstalledModelCatalog,
    private readonly datasetRepository: DatasetRepository,
    private readonly datasetVersionRepository: DatasetVersionRepository,
    private readonly jobRepository: IModelTrainingJobRepository,
    private readonly runtime: IModelTrainingRuntime,
    private readonly environmentGateway: IModelCreationEnvironmentGateway,
    private readonly fileStorage?: IFileStorage,
    private readonly executionEngine?: UnifiedExecutionEngine,
    private readonly createId: () => string = defaultCreateId,
    private readonly canonicalIdentityService?: CanonicalAssetIdentityService,
  ) {
    this.capabilityPolicy = new ModelCreationCapabilityPolicy();
  }

  public async listJobs(): Promise<ReadonlyArray<ModelTrainingJob>> {
    const runtimeJobs = await this.runtime.listJobs().catch(() => [] as ReadonlyArray<ModelTrainingJob>);
    for (const job of runtimeJobs) {
      await this.jobRepository.saveJob(job);
    }

    const jobs = await this.jobRepository.listJobs();
    return this.sortJobs(jobs);
  }

  public async getJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    const runtimeJob = await this.runtime.getJob(jobId).catch(() => undefined);
    if (runtimeJob) {
      await this.jobRepository.saveJob(runtimeJob);
      return runtimeJob;
    }
    return this.jobRepository.getJobById(jobId);
  }

  public async refreshJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    const runtimeJob = await this.runtime.refreshJob(jobId).catch(() => undefined);
    if (runtimeJob) {
      await this.jobRepository.saveJob(runtimeJob);
      return runtimeJob;
    }
    return this.jobRepository.getJobById(jobId);
  }

  public async reconcileJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    const runtimeJob = await this.runtime.reconcileJob(jobId).catch(() => undefined);
    if (runtimeJob) {
      await this.jobRepository.saveJob(runtimeJob);
      return runtimeJob;
    }
    return this.jobRepository.getJobById(jobId);
  }

  public async cancelJob(jobId: string): Promise<ModelTrainingJob> {
    const job = await this.runtime.cancelJob(jobId);
    await this.jobRepository.saveJob(job);
    return job;
  }

  public async getStudioSummary(query: GetModelTrainingStudioSummaryQuery = {}): Promise<ModelTrainingStudioSummary> {
    const [environment, installedModels, datasets, jobs] = await Promise.all([
      this.environmentGateway.getEnvironment(),
      this.installedModelCatalog.listInstalled({ availableOnly: true }),
      this.datasetRepository.list(),
      this.listJobs(),
    ]);

    const datasetVersions = await Promise.all(datasets.map(async (dataset) => {
      const versions = await this.datasetVersionRepository.listVersions(dataset.id);
      return versions.map((version): ModelTrainingDatasetVersionOption => Object.freeze({
        datasetId: dataset.id,
        datasetName: dataset.name,
        versionId: version.id,
        versionNumber: version.versionNumber,
        versionLabel: `v${version.versionNumber}`,
        taskType: dataset.taskType,
        supportsExportPreparation: true,
        supportsLocalTraining: SUPPORTED_LOCAL_TRAINING_TASK_TYPES.has(dataset.taskType),
        localTrainingReason: SUPPORTED_LOCAL_TRAINING_TASK_TYPES.has(dataset.taskType)
          ? undefined
          : `Local training does not support ${dataset.taskType.replace(/_/g, " ")} datasets yet.`,
      }));
    }));

    const flattenedDatasetVersions = Object.freeze(datasetVersions.flat().sort((left, right) => {
      if (left.datasetName === right.datasetName) {
        return right.versionNumber - left.versionNumber;
      }
      return left.datasetName.localeCompare(right.datasetName);
    }));
    const baseModels = Object.freeze(installedModels.map((model) => Object.freeze({
      id: model.id,
      name: model.name,
      accessMethod: model.artifact.accessMethod,
      isAvailable: model.isAvailable(),
      supportsExportPreparation: true,
      supportsLocalTraining: model.artifact.accessMethod === "local-file",
      localTrainingReason: model.artifact.accessMethod === "local-file"
        ? undefined
        : "Local training needs a base model whose primary artifact points to a local file.",
      artifactLocation: model.artifact.location,
    })));

    const selectedBaseModel = baseModels.find((entry) => entry.id === query.selectedBaseModelId)
      ?? baseModels[0];
    const selectedDatasetVersion = flattenedDatasetVersions.find((entry) => entry.versionId === query.selectedDatasetVersionId && entry.datasetId === (query.selectedDatasetId ?? entry.datasetId))
      ?? flattenedDatasetVersions[0];

    const capability = this.capabilityPolicy.evaluate({
      environment,
      selection: {
        baseModel: selectedBaseModel ? {
          id: selectedBaseModel.id,
          name: selectedBaseModel.name,
          accessMethod: selectedBaseModel.accessMethod,
        } : undefined,
        datasetVersion: selectedDatasetVersion ? {
          datasetId: selectedDatasetVersion.datasetId,
          datasetName: selectedDatasetVersion.datasetName,
          versionId: selectedDatasetVersion.versionId,
          versionLabel: selectedDatasetVersion.versionLabel,
          taskType: selectedDatasetVersion.taskType,
        } : undefined,
      },
      inventory: {
        installedBaseModelCount: baseModels.length,
        localBaseModelCount: baseModels.filter((entry) => entry.supportsLocalTraining).length,
        datasetVersionCount: flattenedDatasetVersions.length,
        supportedDatasetVersionCount: flattenedDatasetVersions.filter((entry) => entry.supportsLocalTraining).length,
      },
    });

    const readinessChecks = buildReadinessChecks({
      environment,
      capabilityState: capability.state,
      baseModels,
      selectedBaseModel,
      selectedDatasetVersion,
      datasetVersionCount: flattenedDatasetVersions.length,
    });

    const availableActions = buildAvailableActions(capability.recommendedNextSteps, capability.paths.map((path) => ({
      id: path.path,
      path: path.path,
      label: path.path === "local-training" ? "Start local training" : "Prepare bundle",
      detail: path.summary,
      disabled: path.state === "unavailable",
    })));

    return Object.freeze({
      runtimeMode: environment.runtimeMode,
      runtimeStatus: environment.runtimeStatus,
      runtimeHeadline: capability.headline,
      runtimeDetail: environment.runtimeDetail ?? capability.summary,
      capability,
      availablePaths: Object.freeze(capability.paths.filter((path) => path.state !== "unavailable").map((path) => path.path)),
      selectedBaseModelId: selectedBaseModel?.id,
      selectedDatasetId: selectedDatasetVersion?.datasetId,
      selectedDatasetVersionId: selectedDatasetVersion?.versionId,
      baseModels,
      datasetVersions: flattenedDatasetVersions,
      readinessChecks,
      availableActions,
      modeWarnings: Object.freeze([
        ...capability.warnings,
        ...(environment.runtimeRemediationHints ?? []),
        ...capability.paths.flatMap((path) => path.blockers.filter((entry) => entry.state === "degraded").map((entry) => entry.message)),
      ]),
      recommendedNextSteps: capability.recommendedNextSteps,
      jobs: Object.freeze(await Promise.all(jobs.map((job) => this.toStudioJobSummary(job, installedModels, environment.canRegisterPromotedModels)))),
    });
  }

  public async promoteJob(command: PromoteModelTrainingJobCommand): Promise<PromoteModelTrainingJobResult> {
    const environment = await this.environmentGateway.getEnvironment();
    if (!environment.canRegisterPromotedModels || !this.fileStorage) {
      throw new Error("This runtime mode cannot register completed training outputs into the installed model library.");
    }

    const job = await this.getJob(command.jobId);
    if (!job) {
      throw new Error(`Training job '${command.jobId}' was not found.`);
    }
    if (job.status !== "completed") {
      throw new Error("Only completed local training jobs can be promoted into the model library.");
    }

    const promotion = this.buildPromotionSummary(job, environment.canRegisterPromotedModels);
    if (promotion.state !== "available" || !promotion.artifact?.location) {
      throw new Error(promotion.detail);
    }

    const artifactExists = await this.fileStorage.exists(promotion.artifact.location);
    if (!artifactExists) {
      throw new Error(`The trained model artifact '${promotion.artifact.location}' is not available on disk.`);
    }

    const baseModel = await this.installedModelCatalog.getInstalledById(job.baseModelId);
    const modelId = buildPromotedModelId(job, promotion.artifact);
    const modelName = command.promotedModelName?.trim() || job.outputModelName || `${job.name} output`;
    const promotedModel = new Model({
      id: modelId,
      name: modelName,
      kind: baseModel?.kind ?? "generic",
      status: "installed",
      source: new ModelSource({
        type: "local",
        sourceId: job.id,
        providerMetadata: Object.freeze({
          trainingJobId: job.id,
          promotedFromArtifactId: promotion.artifact.id,
        }),
      }),
      artifact: new ModelArtifact({
        name: promotion.artifact.label,
        accessMethod: "local-file",
        location: promotion.artifact.location,
        format: baseModel?.artifact.format ?? "unknown",
        contentType: promotion.artifact.contentType,
      }),
      additionalArtifacts: job.artifacts
        .filter((artifact) => artifact.id !== promotion.artifact?.id && artifact.location)
        .map((artifact) => new ModelArtifact({
          name: artifact.label,
          accessMethod: "local-file",
          location: artifact.location,
          format: artifact.kind === "checkpoint" ? "bin" : "unknown",
          contentType: artifact.contentType,
        })),
      compatibility: baseModel?.compatibility,
      isRunnable: true,
      architectureFamily: baseModel?.architectureFamily,
      architecture: baseModel?.architecture,
      precision: baseModel?.precision,
      description: `Promoted from training job '${job.name}'.`,
      tags: ["trained-output", "local-training"],
    });

    await this.installedModelCatalog.saveInstalled(promotedModel);

    return Object.freeze({
      status: "registered",
      modelId: promotedModel.id,
      modelName: promotedModel.name,
      detail: `Registered '${promotedModel.name}' in the installed model library.`,
    });
  }

  public async submitJob(command: SubmitModelTrainingJobCommand): Promise<ModelTrainingJob> {
    const baseModel = await this.installedModelCatalog.getInstalledById(command.baseModelId);
    if (!baseModel) {
      throw new Error(`Base model '${command.baseModelId}' is not installed.`);
    }

    const dataset = await this.datasetRepository.load(command.datasetId);
    if (!dataset) {
      throw new Error(`Dataset '${command.datasetId}' was not found.`);
    }

    const version = await this.datasetVersionRepository.loadVersion(command.datasetId, command.datasetVersionId);
    if (!version) {
      throw new Error(`Dataset version '${command.datasetVersionId}' was not found.`);
    }

    const executionKind = command.executionKind ?? "local-gradient-training";
    if (executionKind === "local-gradient-training" && baseModel.artifact.accessMethod !== "local-file") {
      throw new Error("Real local training requires a base model with a local-file artifact.");
    }
    if (executionKind === "local-gradient-training" && !SUPPORTED_LOCAL_TRAINING_TASK_TYPES.has(dataset.taskType)) {
      throw new Error(`Local training currently supports only question_answering or chat_completion datasets, received '${dataset.taskType}'.`);
    }

    const examples = await this.datasetVersionRepository.listExamples({
      datasetId: dataset.id,
      versionId: version.id,
    });
    const eligibleExamples = examples.filter((example) => example.status !== "rejected");
    if (eligibleExamples.length === 0) {
      throw new Error("Training requires at least one non-rejected dataset example.");
    }

    if (executionKind === "local-gradient-training" && command.configuration.epochs < 1) {
      throw new Error("Real local training requires epochs >= 1.");
    }
    if (command.configuration.batchSize < 1) {
      throw new Error("Training batch size must be >= 1.");
    }
    if (command.configuration.learningRate <= 0) {
      throw new Error("Training learning rate must be > 0.");
    }

    const datasetVersionAssetId = await this.canonicalIdentityService?.resolveAssetId("dataset-version", `${dataset.id}:${version.id}`);
    const baseModelAssetId = await this.canonicalIdentityService?.resolveAssetId("base-model", baseModel.id);
    const explicitSourceVersionIds = [
      await this.canonicalIdentityService?.resolveLatestVersionId("dataset-version", `${dataset.id}:${version.id}`),
      await this.canonicalIdentityService?.resolveLatestVersionId("base-model", baseModel.id),
    ].filter((entry): entry is string => typeof entry === "string" && !!entry.trim());

    const submitRequest = {
      id: command.id?.trim() || this.createId(),
      name: command.name,
      executionKind,
      baseModelId: baseModel.id,
      baseModelName: baseModel.name,
      baseModelLocation: baseModel.artifact.location,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersionId: version.id,
      datasetVersionNumber: version.versionNumber,
      datasetTaskType: dataset.taskType,
      createdBy: command.createdBy,
      configuration: command.configuration,
      assetLineage: {
        datasetVersionAssetId,
        baseModelAssetId,
        sourceVersionIds: explicitSourceVersionIds,
      },
      examples: eligibleExamples.map((example) => {
        if (example instanceof QuestionAnsweringExample) {
          return Object.freeze({
            id: example.id,
            taskType: example.taskType,
            inputText: `Question: ${example.question}\n\nContext: ${example.context}`,
            targetText: example.answer,
            sourceDocumentId: example.sourceDocumentId,
          });
        }

        const chatExample = example as ChatCompletionExample;
        const promptMessages = chatExample.messages.filter((message) => message.role !== "assistant");
        const assistantMessages = chatExample.messages.filter((message) => message.role === "assistant");
        return Object.freeze({
          id: chatExample.id,
          taskType: chatExample.taskType,
          inputText: promptMessages.map((message) => `${message.role}: ${message.content}`).join("\n"),
          targetText: assistantMessages.map((message) => message.content).join("\n"),
          sourceDocumentId: chatExample.lineage.sourceDocumentId,
        });
      }),
    } as const;

    const job = executionKind === "preparation-only" && this.executionEngine
      ? await this.submitPreparationThroughExecutionEngine(submitRequest)
      : executionKind === "local-gradient-training" && this.executionEngine
        ? await this.submitTrainingThroughExecutionEngine(submitRequest)
        : await this.runtime.submitJob(submitRequest);

    await this.jobRepository.saveJob(job);
    return job;
  }

  private async submitPreparationThroughExecutionEngine(
    request: import("../ports/interfaces/IModelTrainingRuntime").SubmitModelTrainingJobRequest,
  ): Promise<ModelTrainingJob> {
    if (!this.executionEngine) {
      return this.runtime.submitJob(request);
    }

    const planEnvelope = createModelPreparationExecutionPlan(request);
    const result = await this.executionEngine.execute({
      plan: planEnvelope.plan,
      unitInputs: planEnvelope.unitInputs,
      metadata: planEnvelope.metadata,
    });
    return requireModelPreparationJob(result, planEnvelope.unitId);
  }

  private async submitTrainingThroughExecutionEngine(
    request: import("../ports/interfaces/IModelTrainingRuntime").SubmitModelTrainingJobRequest,
  ): Promise<ModelTrainingJob> {
    if (!this.executionEngine) {
      return this.runtime.submitJob(request);
    }

    const planEnvelope = createModelPreparationAndTrainingExecutionPlan(request);
    let initialJob: ModelTrainingJob | undefined;
    let resolveInitialJob!: (job: ModelTrainingJob) => void;
    const initialJobPromise = new Promise<ModelTrainingJob>((resolve) => {
      resolveInitialJob = resolve;
    });

    const handle = await this.executionEngine.startExecution({
      plan: planEnvelope.plan,
      unitInputs: planEnvelope.unitInputs,
      metadata: planEnvelope.metadata,
    }, (event) => {
      if (event.unitId !== planEnvelope.trainingUnitId) {
        return;
      }
      const job = getModelTrainingJobFromEvent(event);
      if (!job) {
        return;
      }

      initialJob ??= job;
      resolveInitialJob(job);
      void this.jobRepository.saveJob(job);
    });

    void handle.waitForCompletion()
      .then((result) => {
        requireModelPreparationAndTrainingArtifacts(result, planEnvelope.preparationUnitId);
        return this.jobRepository.saveJob(requireModelPreparationAndTrainingJob(
          requireModelPreparationAndTrainingResult(result, planEnvelope.trainingUnitId),
        ));
      })
      .catch(() => undefined);

    return await Promise.race([
      initialJobPromise,
      this.waitForModelTrainingJob(request.id),
    ]);
  }

  private async waitForModelTrainingJob(jobId: string): Promise<ModelTrainingJob> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await this.runtime.getJob(jobId).catch(() => undefined);
      if (job) {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Model training job '${jobId}' was submitted but the runtime did not expose an initial durable snapshot in time.`);
  }

  private async toStudioJobSummary(
    job: ModelTrainingJob,
    installedModels: ReadonlyArray<IModel>,
    canRegisterPromotedModels: boolean,
  ): Promise<ModelTrainingJobStudioSummary> {
    const baseModel = installedModels.find((entry) => entry.id === job.baseModelId);
    const promotion = this.buildPromotionSummary(job, canRegisterPromotedModels);
    return Object.freeze({
      job,
      userFacingStatus: presentJobStatus(job),
      technicalSummary: [job.backend, job.provenance.truthfulness, job.provenance.runMode].join(" • "),
      technicalDetails: Object.freeze({
        baseModel: baseModel?.name ?? job.baseModelId,
        durablePath: job.provenance.path,
        provider: job.provenance.provider,
        diagnostics: job.provenance.diagnostics,
      }),
      primaryArtifact: selectPrimaryArtifact(job),
      promotion,
    });
  }

  private buildPromotionSummary(job: ModelTrainingJob, canRegisterPromotedModels: boolean): ModelTrainingPromotionSummary {
    if (job.status !== "completed") {
      return Object.freeze({
        state: "unavailable",
        label: "Not ready yet",
        detail: "Promotion becomes available after a local training job reaches completed.",
      });
    }

    const artifact = selectPromotableArtifact(job);
    if (!artifact) {
      return Object.freeze({
        state: "unavailable",
        label: "No trained model artifact",
        detail: "This completed job does not expose a trained model artifact that can be registered.",
      });
    }

    if (!canRegisterPromotedModels) {
      return Object.freeze({
        state: "unavailable",
        label: "Promotion unavailable in this mode",
        detail: "This runtime can inspect completed outputs, but only desktop file-backed modes can register them in the installed model library.",
        artifact,
      });
    }

    return Object.freeze({
      state: "available",
      label: "Add to installed models",
      detail: "Register the completed output in the installed model library so workflows can reuse it.",
      artifact,
    });
  }

  private sortJobs(jobs: ReadonlyArray<ModelTrainingJob>): ReadonlyArray<ModelTrainingJob> {
    return Object.freeze([...jobs].sort((left, right) => {
      const rightTime = right.submittedAt?.getTime() ?? right.createdAt.getTime();
      const leftTime = left.submittedAt?.getTime() ?? left.createdAt.getTime();
      return rightTime - leftTime;
    }));
  }
}

function buildReadinessChecks(params: {
  readonly environment: Awaited<ReturnType<IModelCreationEnvironmentGateway["getEnvironment"]>>;
  readonly capabilityState: ModelCreationSupportState;
  readonly baseModels: ReadonlyArray<{
    readonly id: string;
    readonly supportsLocalTraining: boolean;
  }>;
  readonly selectedBaseModel?: { readonly id: string; readonly supportsLocalTraining: boolean };
  readonly selectedDatasetVersion?: ModelTrainingDatasetVersionOption;
  readonly datasetVersionCount: number;
}): ReadonlyArray<ModelTrainingReadinessCheck> {
  return Object.freeze([
    {
      id: "runtime",
      title: "Runtime connection",
      state: params.environment.runtimeStatus === "ready"
        ? "available"
        : params.environment.runtimeStatus === "degraded"
          ? "degraded"
          : "unavailable",
      detail: [
        params.environment.runtimeDetail ?? "Runtime status unknown.",
        ...(params.environment.runtimeRemediationHints ?? []),
      ].filter(Boolean).join(" "),
    },
    {
      id: "base-model",
      title: "Base model",
      state: !params.selectedBaseModel
        ? "unavailable"
        : params.selectedBaseModel.supportsLocalTraining
          ? "available"
          : "degraded",
      detail: !params.baseModels.length
        ? "No installed base models are available yet."
        : !params.selectedBaseModel
          ? "Choose one installed base model."
          : params.selectedBaseModel.supportsLocalTraining
            ? "The selected model is stored on disk and can be used for local training."
            : "The selected model can be used for preparation, but not for real local training.",
    },
    {
      id: "dataset-version",
      title: "Dataset version",
      state: !params.selectedDatasetVersion
        ? "unavailable"
        : params.selectedDatasetVersion.supportsLocalTraining
          ? "available"
          : "degraded",
      detail: params.datasetVersionCount === 0
        ? "No dataset versions are available yet."
        : !params.selectedDatasetVersion
          ? "Choose one dataset version to continue."
          : params.selectedDatasetVersion.supportsLocalTraining
            ? "The selected dataset version supports both preparation and real local training."
            : params.selectedDatasetVersion.localTrainingReason ?? "The selected dataset version is only available for preparation.",
    },
    {
      id: "mode",
      title: "Runtime mode",
      state: params.capabilityState,
      detail: params.environment.runtimeMode === "browser-development"
        ? "Browser fallback mode is guided and limited. Use the desktop app for full local training and promotion."
        : "Desktop mode can expose real local training when the runtime and files are available.",
    },
  ]);
}

function buildAvailableActions(
  nextSteps: ReadonlyArray<ModelCreationRecommendedAction>,
  pathActions: ReadonlyArray<ModelTrainingStudioAction>,
): ReadonlyArray<ModelTrainingStudioAction> {
  const result = [...pathActions];
  for (const step of nextSteps) {
    result.push(Object.freeze({
      id: step.id,
      label: step.label,
      detail: step.detail,
      disabled: false,
    }));
  }
  return Object.freeze(result);
}

function presentJobStatus(job: ModelTrainingJob): string {
  switch (job.status) {
    case "submitted":
      return "Waiting for the runtime to accept the job.";
    case "queued":
      return "Queued and waiting for a training slot.";
    case "running":
      return job.progress?.statusDetail ?? "Training is currently running.";
    case "completed":
      return "Training finished and produced a completed output.";
    case "failed":
      return job.diagnostics[0]?.message ?? "Training failed.";
    case "cancelled":
      return "The job was cancelled before completion.";
    case "reconciliation-needed":
      return "The runtime reported that this job needs reconciliation before it is trusted again.";
    case "partially-completed":
      return "The runtime produced partial output and saved diagnostics for review.";
    case "exported-without-training":
      return "Preparation finished without claiming a trained model.";
    default:
      return job.status;
  }
}

function selectPrimaryArtifact(job: ModelTrainingJob): ModelTrainingArtifact | undefined {
  return selectPromotableArtifact(job)
    ?? job.artifacts.find((artifact) => artifact.kind === "prepared-bundle")
    ?? job.artifacts[0];
}

function selectPromotableArtifact(job: ModelTrainingJob): ModelTrainingArtifact | undefined {
  return job.artifacts.find((artifact) => artifact.kind === "trained-model" && Boolean(artifact.location));
}

function buildPromotedModelId(job: ModelTrainingJob, artifact: ModelTrainingArtifact): string {
  return `trained-output:${job.id}:${artifact.id}`;
}
