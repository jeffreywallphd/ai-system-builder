import type { IAssetRepository } from "@application/assets/ports/IAssetRepository";
import type {
  IRunSubmissionTargetResolverPort,
  RunSubmissionTargetResolutionRequest,
  RunSubmissionTargetResolutionResult,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import { AssetLifecycleStates } from "@domain/assets/AssetDomain";

export class AssetBackedRunSubmissionTargetResolver implements IRunSubmissionTargetResolverPort {
  public constructor(
    private readonly assetRepository: IAssetRepository,
  ) {}

  public async resolveRunSubmissionTarget(
    request: RunSubmissionTargetResolutionRequest,
  ): Promise<RunSubmissionTargetResolutionResult> {
    const systemId = request.systemId.trim();
    const versionId = request.versionId.trim();
    if (!systemId || !versionId) {
      return Object.freeze({
        systemExists: false,
        versionExists: false,
        workflowExists: request.workflowId ? false : undefined,
        templateExists: request.templateId ? false : undefined,
      });
    }

    const asset = await this.assetRepository.findAssetById(systemId);
    if (!asset || asset.lifecycle.state === AssetLifecycleStates.deleted || asset.ownership.workspaceId !== request.workspaceId) {
      return Object.freeze({
        systemExists: false,
        versionExists: false,
        workflowExists: request.workflowId ? false : undefined,
        templateExists: request.templateId ? false : undefined,
      });
    }

    const versionExists = asset.versions.some((version) => version.versionId === versionId);
    return Object.freeze({
      systemExists: true,
      versionExists,
      workflowExists: request.workflowId ? false : undefined,
      templateExists: request.templateId ? false : undefined,
    });
  }
}

