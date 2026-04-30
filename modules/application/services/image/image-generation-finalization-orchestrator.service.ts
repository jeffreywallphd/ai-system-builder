import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { FinalizeImageGenerationService } from "./finalize-image-generation.service";

export class ImageGenerationFinalizationOrchestratorService {
  private readonly finalizedRequests = new Set<string>();

  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      finalizeImageGenerationService: FinalizeImageGenerationService;
    },
  ) {}

  public async finalizeIfCompleted(requestId: string): Promise<void> {
    if (this.finalizedRequests.has(requestId)) return;

    const task = await this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
    if (task.status !== "succeeded") return;

    const outputs = this.readOutputs(task.data);
    if (outputs.some((output) => this.hasArtifactId(output))) {
      this.finalizedRequests.add(requestId);
      return;
    }

    await this.dependencies.finalizeImageGenerationService.finalizeCompletedTask(task);
    this.finalizedRequests.add(requestId);
  }

  private readOutputs(data: unknown): Array<Record<string, unknown>> {
    if (typeof data !== "object" || data === null) return [];
    const outputs = (data as { outputs?: unknown }).outputs;
    return Array.isArray(outputs) ? outputs.filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null) : [];
  }

  private hasArtifactId(output: Record<string, unknown>): boolean {
    const artifactId = output.artifactId;
    return typeof artifactId === "string" && artifactId.length > 0;
  }
}
