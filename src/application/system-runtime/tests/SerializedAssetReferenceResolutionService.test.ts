import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { createSystemStudioTaxonomy } from "../../../domain/system-studio/SystemAssetDomain";
import { SerializedAssetReferenceResolutionService } from "../SerializedAssetReferenceResolutionService";

class Repo implements IStudioShellRepository {
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { return studio; }
  async getStudio(): Promise<Studio | undefined> { return undefined; }
  async saveSession(session: AssetSession): Promise<AssetSession> { return session; }
  async getSession(): Promise<AssetSession | undefined> { return undefined; }
  async listStudioSessions(): Promise<ReadonlyArray<AssetSession>> { return []; }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { return draft; }
  async getDraft(): Promise<AssetDraft | undefined> { return undefined; }
  async listSessionDrafts(): Promise<ReadonlyArray<AssetDraft>> { return []; }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId);
  }
}

function createVersion(input: { assetId: string; versionId: string; taxonomy?: ReturnType<typeof createSystemStudioTaxonomy> }) {
  return new AssetVersion({
    assetId: input.assetId,
    versionId: input.versionId,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    metadata: input.taxonomy
      ? { metadata: { taxonomy: input.taxonomy } }
      : undefined,
  });
}

describe("SerializedAssetReferenceResolutionService", () => {
  it("resolves matching references by kind/id/version", async () => {
    const repository = new Repo();
    await repository.saveAssetVersion(createVersion({ assetId: "workflow:image-edit", versionId: "workflow:image-edit:v1" }));

    const service = new SerializedAssetReferenceResolutionService(repository);
    const result = await service.resolveReferences({
      serializedSchemaVersion: "1.0.0",
      references: [{ kind: "workflow", assetId: "workflow:image-edit", versionId: "workflow:image-edit:v1" }],
    });

    expect(result.ok).toBeTrue();
    expect(result.resolved[0]?.resolvedVersion.versionId).toBe("workflow:image-edit:v1");
  });

  it("returns structured issues for missing assets and version mismatch", async () => {
    const repository = new Repo();
    await repository.saveAssetVersion(createVersion({ assetId: "dataset:images", versionId: "dataset:images:v2" }));

    const service = new SerializedAssetReferenceResolutionService(repository);
    const result = await service.resolveReferences({
      serializedSchemaVersion: "1.0.0",
      references: [
        { kind: "dataset", assetId: "dataset:images", versionId: "dataset:images:v1" },
        { kind: "workflow", assetId: "workflow:missing", versionId: "workflow:missing:v1" },
      ],
    });

    expect(result.ok).toBeFalse();
    expect(result.issues.map((issue) => issue.code)).toEqual(["incompatible-version", "missing-asset"]);
  });

  it("rejects unsupported serialized schema versions", async () => {
    const service = new SerializedAssetReferenceResolutionService(new Repo());
    const result = await service.resolveReferences({
      serializedSchemaVersion: "2.0.0",
      references: [{ kind: "workflow", assetId: "workflow:image-edit" }],
    });

    expect(result.ok).toBeFalse();
    expect(result.issues[0]?.code).toBe("unsupported-serialized-version");
  });
});
