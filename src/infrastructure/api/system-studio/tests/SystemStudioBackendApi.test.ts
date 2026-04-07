import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "@domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "@application/studio-shell/DefaultStudioShellApplicationService";
import { SystemStudioApplicationService } from "@application/system-studio/SystemStudioApplicationService";
import { SystemStudioIdentity } from "@domain/system-studio/SystemAssetDomain";
import { SystemStudioBackendApi } from "../SystemStudioBackendApi";

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

describe("SystemStudioBackendApi", () => {
  it("supports list/add/remove/reorder child component operations through backend API", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const systemService = new SystemStudioApplicationService(studioShell, repository);
    const api = new SystemStudioBackendApi(repository);

    const ensure = await systemService.ensureStudioInitialized();
    const created = await systemService.createSystemDraft({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System",
      content: JSON.stringify({ systemSpec: { components: [] } }),
    });

    const added = await api.addChildComponent({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: {
        componentKind: "atomic",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        alias: "model-a",
      },
    });
    expect(added.ok).toBeTrue();

    await api.addChildComponent({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: {
        componentKind: "system",
        assetId: "system:child",
        versionId: "system:child:v1",
        alias: "child-a",
      },
    });

    const listed = await api.listChildComponents({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.map((entry) => entry.assetId)).toEqual(["asset:model", "system:child"]);

    await api.reorderChildComponent({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      componentAssetId: "system:child",
      componentVersionId: "system:child:v1",
      toIndex: 0,
    });

    const reordered = await api.listChildComponents({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
    });
    expect(reordered.data?.map((entry) => entry.assetId)).toEqual(["system:child", "asset:model"]);

    await api.removeChildComponent({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      componentAssetId: "asset:model",
      componentVersionId: "asset:model:v1",
    });

    const removed = await api.listChildComponents({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
    });
    expect(removed.data?.map((entry) => entry.assetId)).toEqual(["system:child"]);
  });

  it("projects recursive compatibility insights from system validation outputs", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const systemService = new SystemStudioApplicationService(studioShell, repository);
    const api = new SystemStudioBackendApi(repository);

    const ensure = await systemService.ensureStudioInitialized();
    const created = await systemService.createSystemDraft({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System",
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "system",
              assetId: "system:missing",
              versionId: "system:missing:v1",
              alias: "missing",
            },
          ],
          inputs: [{ inputId: "in", valueType: "string", required: true }],
          outputs: [{ outputId: "out", valueType: "string" }],
          bindings: [{
            bindingId: "bind-invalid-target",
            source: { scope: "system-input", endpointId: "in" },
            target: { scope: "component-input", componentAlias: "missing", endpointId: "missing-input" },
          }],
        },
      }),
      dependencies: [{ assetId: "system:missing", versionId: "system:missing:v1" }],
    });

    const insights = await api.getCompatibilityInsights({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
    });
    expect(insights.ok).toBeTrue();
    expect(insights.data?.summary.status).toBe("incompatible");
    expect(insights.data?.summary.incompatibleChildAssetCount).toBeGreaterThan(0);
    expect(insights.data?.summary.unresolvedNestedSystemCount).toBeGreaterThan(0);
    expect(insights.data?.summary.interfaceMismatchCount).toBeGreaterThan(0);
    expect(insights.data?.issues.some((issue) => issue.code === "system-child-reference-missing")).toBeTrue();
  });

  it("supports canonical save/duplicate/modify system-definition operations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-root", "draft-copy"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const systemService = new SystemStudioApplicationService(studioShell, repository);
    const api = new SystemStudioBackendApi(repository);

    const ensure = await systemService.ensureStudioInitialized();
    const created = await systemService.createSystemDraft({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System",
      content: JSON.stringify({ systemSpec: { components: [], inputs: [], outputs: [], parameters: [], bindings: [] } }),
    });

    const saved = await api.saveSystemDefinition({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
    });
    expect(saved.ok).toBeTrue();

    const duplicated = await api.duplicateSystemDefinition({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      sourceDraftId: created.draft.id,
      duplicateDraftId: "draft-copy",
    });
    expect(duplicated.ok).toBeTrue();

    const modified = await api.modifySystemDefinition({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: "draft-copy",
      runtimeStatePatch: { quickMode: true },
    });
    expect(modified.ok).toBeTrue();

    const loaded = await api.loadSystemDefinition({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: "draft-copy",
    });
    expect(loaded.ok).toBeTrue();
  });
});

