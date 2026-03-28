import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { ModelStudioApplicationService } from "../ModelStudioApplicationService";
import { ModelStudioIdentity } from "../../../domain/model-studio/ModelStudioDomain";

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

describe("ModelStudioApplicationService", () => {
  it("authors model drafts with atomic model taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ModelStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createModelDraft({
      sessionId: ensure.session.id,
      title: "Model Draft",
      content: '{"model":"llama"}',
      creatorId: "author-1",
      tags: ["foundation"],
    });

    expect(ensure.studio.id).toBe(ModelStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("atomic");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("model");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("none");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual(["model", "foundation"]);
  });

  it("reuses shared lifecycle/version flow when publishing model drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ModelStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createModelDraft({
      sessionId: ensure.session.id,
      title: "Model Draft",
      content: "{}",
    });

    const published = await service.publishModelDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "model-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("model-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["model-version-1"]);
  });

  it("blocks publish when model draft taxonomy/contract drift from atomic model expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ModelStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createModelDraft({
      sessionId: ensure.session.id,
      title: "Model Draft",
      content: "{}",
    });

    await studioShell.updateAssetDraft({
      studioId: ModelStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      },
    });

    await expect(service.publishModelDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "model-version-invalid",
    })).rejects.toThrow("Atomic studio draft enforcement failed");
  });
});
