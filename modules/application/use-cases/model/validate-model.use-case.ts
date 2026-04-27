import { type ValidateModelRequest, type ValidateModelResult } from "../../../contracts/model";
import type { ModelRegistryPort, ModelValidationPort } from "../../ports/model";

export class ValidateModelUseCase {
  public constructor(
    private readonly dependencies: {
      modelValidation: ModelValidationPort;
      modelRegistry: ModelRegistryPort;
    },
  ) {}

  public async execute(request: ValidateModelRequest): Promise<ValidateModelResult> {
    const model = await this.dependencies.modelRegistry.getModelRecord(request.modelRecordId);
    if (!model) {
      throw new Error(`Model record '${request.modelRecordId}' was not found.`);
    }

    const result = await this.dependencies.modelValidation.validateModel({
      ...request,
      modelPath: request.modelPath ?? model.localPath,
    });

    const nextLifecycleStatus = result.status === "valid"
      ? "validated"
      : (result.status === "invalid" ? "invalid" : model.lifecycleStatus);

    await this.dependencies.modelRegistry.updateModelRecord({
      modelRecordId: request.modelRecordId,
      patch: {
        validationStatus: result.status,
        validationReportPath: result.reportPath,
        serializationFormat: result.serializationFormat,
        lifecycleStatus: nextLifecycleStatus,
        metadata: {
          ...(model.metadata ?? {}),
          validationDiffPath: result.diffPath,
          validationWarnings: result.warnings,
          validationErrors: result.errors,
          shardCount: result.shardCount,
        },
      },
    });

    return result;
  }
}
