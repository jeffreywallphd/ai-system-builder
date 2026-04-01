import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";
import type { SystemDatasetOwnershipValidator } from "./SystemDatasetInstanceService";

export class StudioShellSystemDatasetOwnershipValidator implements SystemDatasetOwnershipValidator {
  public constructor(private readonly repository: IStudioShellRepository) {}

  public async assertSystemExists(systemId: string): Promise<void> {
    const normalized = systemId.trim();
    if (!normalized) {
      throw new Error("invalid-request:System id is required.");
    }

    const versions = await this.repository.listAssetVersionsByAssetId(normalized);
    if (versions.length === 0) {
      throw new Error(`invalid-request:System '${normalized}' does not exist.`);
    }
  }
}
