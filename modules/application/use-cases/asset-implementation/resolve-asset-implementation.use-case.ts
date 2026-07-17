import type {
  AssetImplementationResolutionRequest,
  AssetImplementationResolutionResult,
} from "../../../contracts/asset-implementation";
import type { AssetImplementationRepositoryPort } from "../../ports/asset-implementation";
import {
  assertSafeAssetImplementationReadModel,
  resolveAssetImplementation,
} from "../../services/asset-implementation";

export class ResolveAssetImplementationUseCase {
  public constructor(
    private readonly repository: AssetImplementationRepositoryPort,
  ) {}

  public async execute(
    request: AssetImplementationResolutionRequest,
  ): Promise<AssetImplementationResolutionResult> {
    const bindings = await this.repository.listBindings(request.workspaceId);
    const releases = await this.repository.listReleases(request.workspaceId);
    const revocations = await this.repository.listRevocations(
      releases.map((release) => release.releaseId),
    );
    const result = resolveAssetImplementation(
      request,
      bindings,
      releases,
      revocations,
    );
    assertSafeAssetImplementationReadModel(result);
    return result;
  }
}
