import { type PublishModelRequest, type PublishModelResult } from "../../../contracts/model";
import type { ModelPublisherPort, ModelRegistryPort, ModelValidationPort } from "../../ports/model";

export class PublishModelUseCase {
  public constructor(
    private readonly dependencies: {
      modelRegistry: ModelRegistryPort;
      modelValidation: ModelValidationPort;
      modelPublisher: ModelPublisherPort;
    },
  ) {}

  public async execute(request: PublishModelRequest): Promise<PublishModelResult> {
    const model = await this.dependencies.modelRegistry.getModelRecord(request.modelRecordId);
    if (!model || !model.localPath) {
      throw new Error(`Model '${request.modelRecordId}' is missing a local model path and cannot be published.`);
    }

    const validationMetadata = (model.metadata ?? {}) as Record<string, unknown>;
    const hasCurrentValidation = (
      model.validationStatus
      && model.validationStatus !== "unknown"
      && typeof validationMetadata.validatedModelPath === "string"
      && validationMetadata.validatedModelPath === model.localPath
      && typeof validationMetadata.validatedAt === "string"
      && validationMetadata.validatedAt.length > 0
      && validationMetadata.validationStrictness === "publish"
    );

    let validationStatus = model.validationStatus;
    let validationResult: Awaited<ReturnType<ModelValidationPort["validateModel"]>> | undefined;
    let latestMetadata: Record<string, unknown> = { ...(model.metadata ?? {}) };

    if (request.forceRevalidate || !hasCurrentValidation) {
      validationResult = await this.dependencies.modelValidation.validateModel({
        modelRecordId: model.modelRecordId,
        modelPath: model.localPath,
        validationStrictness: "publish",
      });
      validationStatus = validationResult.status;
      latestMetadata = {
        ...latestMetadata,
        validationDiffPath: validationResult.diffPath,
        validationWarnings: validationResult.warnings,
        validationErrors: validationResult.errors,
        shardCount: validationResult.shardCount,
        validatedModelPath: validationResult.validatedModelPath ?? model.localPath,
        validatedAt: validationResult.validatedAt ?? new Date().toISOString(),
        validationStrictness: validationResult.validationStrictness ?? "publish",
        tensorChecksCompleted: validationResult.tensorChecksCompleted,
      };
      await this.dependencies.modelRegistry.updateModelRecord({
        modelRecordId: request.modelRecordId,
        patch: {
          validationStatus: validationResult.status,
          validationReportPath: validationResult.reportPath,
          serializationFormat: validationResult.serializationFormat,
          metadata: latestMetadata,
        },
      });
    }

    const allowWarningValidation = request.allowWarningValidation ?? request.allowInvalid === true;
    const allowInvalidValidation = request.allowInvalidValidation ?? request.allowInvalid === true;
    const isWarning = validationStatus === "warning";
    const isInvalid = validationStatus === "invalid";
    const isPublishBlocked = validationStatus !== "valid"
      && ((isWarning && !allowWarningValidation) || (isInvalid && !allowInvalidValidation) || (!isWarning && !isInvalid));

    if (isPublishBlocked) {
      throw new Error(`Model '${request.modelRecordId}' failed validation and cannot be published without override.`);
    }

    const published = await this.dependencies.modelPublisher.publishModel({
      ...request,
      modelPath: model.localPath,
    });
    const publishedAt = new Date().toISOString();

    await this.dependencies.modelRegistry.updateModelRecord({
      modelRecordId: request.modelRecordId,
      patch: {
        published: {
          provider: published.provider,
          repository: published.repository,
          revision: published.revision,
          url: published.url,
          publishedAt,
        },
        metadata: {
          ...latestMetadata,
          publishedProvider: published.provider,
          publishedRepository: published.repository,
          publishedRevision: published.revision,
          publishedUrl: published.url,
          publishedAt,
        },
      },
    });

    return {
      ...published,
      validationStatus,
      warnings: validationResult?.warnings,
      errors: validationResult?.errors,
    };
  }
}
