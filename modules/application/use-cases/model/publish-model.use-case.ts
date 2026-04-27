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

    let validationStatus = model.validationStatus;
    if (request.forceRevalidate || !validationStatus || validationStatus === "unknown") {
      const validation = await this.dependencies.modelValidation.validateModel({
        modelRecordId: model.modelRecordId,
        modelPath: model.localPath,
      });
      validationStatus = validation.status;
    }

    if (!request.allowInvalid && validationStatus !== "valid" && validationStatus !== "warning") {
      throw new Error(`Model '${request.modelRecordId}' failed validation and cannot be published without override.`);
    }

    const published = await this.dependencies.modelPublisher.publishModel({
      ...request,
      modelPath: model.localPath,
    });

    await this.dependencies.modelRegistry.updateModelRecord({
      modelRecordId: request.modelRecordId,
      patch: {
        provider: "huggingface",
        source: "huggingface",
        lifecycleStatus: "validated",
        modelId: request.repository,
        metadata: {
          ...(model.metadata ?? {}),
          publishedRepo: request.repository,
          publishedRevision: request.revision,
        },
      },
    });

    return { ...published, validationStatus };
  }
}
