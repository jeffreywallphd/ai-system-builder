import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { ConfigProfileStudioApplicationService } from "../ConfigProfileStudioApplicationService";
import { ConfigProfileStudioIdentity } from "../../../domain/config-profile-studio/ConfigProfileStudioDomain";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

describe("ConfigProfileStudioApplicationService", () => {
  it("authors config-profile drafts with atomic config-profile taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ConfigProfileStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createConfigProfileDraft({
      sessionId: ensure.session.id,
      title: "Runtime Config Profile",
      content: '{"runtimeProfile":{"preferredRuntime":"python","env":{"mode":"prod"}}}',
      creatorId: "author-1",
      tags: ["runtime"],
    });

    expect(ensure.studio.id).toBe(ConfigProfileStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("atomic");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("config-profile");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("none");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "profileScope")?.defaultValue).toBe("runtime");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual(["config-profile", "runtime"]);
  });

  it("reuses shared lifecycle/version flow when publishing config-profile drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ConfigProfileStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createConfigProfileDraft({
      sessionId: ensure.session.id,
      title: "Config Profile Draft",
      content: "{}",
    });

    const published = await service.publishConfigProfileDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "config-profile-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("config-profile-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["config-profile-version-1"]);
  });

  it("blocks publish when config-profile taxonomy semantic role drifts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ConfigProfileStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createConfigProfileDraft({
      sessionId: ensure.session.id,
      title: "Config Profile",
      content: "{}",
    });

    await studioShell.updateAssetDraft({
      studioId: ConfigProfileStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      },
    });

    await expect(service.publishConfigProfileDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "config-profile-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });
});
