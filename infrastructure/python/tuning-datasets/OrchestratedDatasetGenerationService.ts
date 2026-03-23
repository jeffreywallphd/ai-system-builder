import type { DatasetGenerationRequest, DatasetGenerationResult, DatasetGenerationService } from "../../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import {
  RuntimeDependencyIds,
  RuntimeDependencyUnavailableError,
  type IRuntimeDependencyOrchestrator,
} from "../../../application/runtime/RuntimeDependencyOrchestrator";
import { createRuntimeDependencyDetail } from "../../runtime/RuntimeDependencyDiagnostics";

export class OrchestratedDatasetGenerationService implements DatasetGenerationService {
  constructor(
    private readonly delegate: DatasetGenerationService,
    private readonly orchestrator: IRuntimeDependencyOrchestrator,
  ) {}

  public async generate(request: DatasetGenerationRequest): Promise<DatasetGenerationResult> {
    const resolution = await this.orchestrator.ensureAvailable(RuntimeDependencyIds.datasetGenerationRuntime);
    if (!resolution.available) {
      throw new RuntimeDependencyUnavailableError(
        resolution,
        createRuntimeDependencyDetail(resolution, "Dataset generation runtime is unavailable."),
      );
    }

    return this.delegate.generate(request);
  }
}
