import type { ICanonicalAssetIdentityRepository, CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export class CanonicalAssetIdentityService {
  constructor(
    private readonly identityRepository: ICanonicalAssetIdentityRepository,
    private readonly versionRepository: IAssetVersionRepository,
  ) {}

  public async resolveAssetId(entityType: CanonicalEntityType, entityId: string): Promise<string | undefined> {
    const identity = await this.identityRepository.getIdentity(entityType, entityId);
    return identity?.assetId;
  }

  public async resolveIdentity(entityType: CanonicalEntityType, entityId: string) {
    return this.identityRepository.getIdentity(entityType, entityId);
  }

  public async resolveLatestVersionId(entityType: CanonicalEntityType, entityId: string): Promise<string | undefined> {
    const identity = await this.identityRepository.getIdentity(entityType, entityId);
    if (!identity) {
      return undefined;
    }

    if (identity.latestVersionId) {
      return identity.latestVersionId;
    }

    const versions = await this.versionRepository.listVersionsByAssetId(identity.assetId);
    return versions[0]?.versionId;
  }

  public async pinVersionId(entityType: CanonicalEntityType, entityId: string, versionId: string): Promise<void> {
    const existing = await this.identityRepository.getIdentity(entityType, entityId);
    if (!existing) {
      throw new Error(`Canonical identity '${entityType}:${entityId}' was not found.`);
    }

    await this.identityRepository.upsertIdentity({
      entityType,
      entityId,
      assetId: existing.assetId,
      latestVersionId: versionId,
      taxonomy: existing.taxonomy,
      updatedAt: new Date(),
    });
  }
}
