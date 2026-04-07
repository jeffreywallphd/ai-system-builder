import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import { CanonicalWorkflowTemplateContractResolver } from "./CanonicalWorkflowTemplateContractResolver";
import { WorkflowTemplateAssetService } from "./WorkflowTemplateAssetService";

export function createWorkflowTemplateAssetService(input: {
  readonly assetCatalog: IAssetCatalog;
  readonly fileStorage: IFileStorage;
  readonly rootDirectory: string;
  readonly workflowRepository: IWorkflowRepository;
}): WorkflowTemplateAssetService {
  return new WorkflowTemplateAssetService(
    input.assetCatalog,
    input.fileStorage,
    input.rootDirectory,
    new CanonicalWorkflowTemplateContractResolver(input.workflowRepository),
  );
}
