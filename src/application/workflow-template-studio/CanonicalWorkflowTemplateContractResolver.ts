import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import type { WorkflowTemplateWorkflowContractResolver } from "./WorkflowTemplateCompositionResolver";

function toWorkflowIdFromAssetId(assetId: string): string {
  const normalized = assetId.trim();
  if (normalized.startsWith("workflow-definition:")) {
    return normalized.slice("workflow-definition:".length);
  }
  if (normalized.startsWith("asset:workflow:")) {
    return normalized.slice("asset:workflow:".length);
  }
  return normalized;
}

export class CanonicalWorkflowTemplateContractResolver implements WorkflowTemplateWorkflowContractResolver {
  private readonly resolver: CompositionAssetContractResolver;

  constructor(private readonly workflowRepository: IWorkflowRepository) {
    this.resolver = new CompositionAssetContractResolver({ workflowRepository });
  }

  public async resolveWorkflowContract(input: {
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
  }): Promise<AssetContractDescriptor | undefined> {
    const workflowId = toWorkflowIdFromAssetId(input.workflowAssetId);
    const workflow = await this.workflowRepository.load(workflowId);
    return workflow ? this.resolver.resolveWorkflowContract(workflow) : undefined;
  }
}

