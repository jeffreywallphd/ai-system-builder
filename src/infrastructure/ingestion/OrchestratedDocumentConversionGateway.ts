import type { DocumentConversionGateway, DocumentConversionRequest, DocumentConversionResult } from "../../application/ingestion/DocumentConversionGateway";
import {
  RuntimeDependencyIds,
  RuntimeDependencyUnavailableError,
  type IRuntimeDependencyOrchestrator,
} from "../../application/runtime/RuntimeDependencyOrchestrator";
import { createRuntimeDependencyDetail } from "../runtime/RuntimeDependencyDiagnostics";

export class OrchestratedDocumentConversionGateway implements DocumentConversionGateway {
  constructor(
    private readonly delegate: DocumentConversionGateway,
    private readonly orchestrator: IRuntimeDependencyOrchestrator,
  ) {}

  public async convert(request: DocumentConversionRequest): Promise<DocumentConversionResult> {
    const resolution = await this.orchestrator.ensureAvailable(RuntimeDependencyIds.documentConversionRuntime);
    if (!resolution.available) {
      throw new RuntimeDependencyUnavailableError(
        resolution,
        createRuntimeDependencyDetail(resolution, "Document conversion runtime is unavailable."),
      );
    }

    return this.delegate.convert(request);
  }
}
