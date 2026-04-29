import { TaskType, type RuntimeTaskRecord } from "../../../contracts/runtime";
import { type PublishModelRequest, type PublishModelResult } from "../../../contracts/model";
import type { ModelRegistryPort } from "../../ports/model";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";

export class PublishModelUseCase {
  public constructor(
    private readonly dependencies: {
      modelRegistry: ModelRegistryPort;
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
    },
  ) {}

  public async execute(request: PublishModelRequest): Promise<PublishModelResult> {
    const model = await this.dependencies.modelRegistry.getModelRecord(request.modelRecordId);
    if (!model || !model.localPath) {
      throw new Error(`Model '${request.modelRecordId}' is missing a local model path and cannot be published.`);
    }
    const started = await this.dependencies.runtimeTaskRegistry.startTask({ taskType: TaskType.MODEL_PUBLISHING, payload: request });
    return { modelRecordId: request.modelRecordId, published: false, provider: "huggingface", repository: request.repository, requestId: started.requestId } as PublishModelResult;
  }

  public async read(requestId: string): Promise<PublishModelResult> {
    const status = await this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
    if (status.status === "running" || status.status === "queued") {
      return { modelRecordId: "", published: false, provider: "huggingface", repository: "", requestId } as PublishModelResult;
    }
    if (status.status === "failed" || status.status === "cancelled" || status.status === "unknown") {
      throw new Error(status.error?.message ?? "Model publishing failed.");
    }
    return this.resolveSucceeded(status, requestId);
  }

  private async resolveSucceeded(statusRecord: RuntimeTaskRecord, requestId: string): Promise<PublishModelResult> {
    if (!statusRecord.data || typeof statusRecord.data !== "object") {
      throw new Error(`Model publishing runtime result missing for request '${statusRecord.requestId}'.`);
    }
    const result = statusRecord.data as PublishModelResult;
    const model = await this.dependencies.modelRegistry.getModelRecord(result.modelRecordId);
    if (!model) {
      throw new Error(`Model record '${result.modelRecordId}' was not found.`);
    }
    const metadata = { ...(model.metadata ?? {}), publishedProvider: result.provider, publishedRepository: result.repository, publishedRevision: result.revision, publishedUrl: result.url, publishedAt: new Date().toISOString() };
    await this.dependencies.modelRegistry.updateModelRecord({ modelRecordId: result.modelRecordId, patch: { published: { provider: result.provider, repository: result.repository, revision: result.revision, url: result.url, publishedAt: metadata.publishedAt as string }, metadata } });
    return { ...result, requestId } as PublishModelResult;
  }
}
