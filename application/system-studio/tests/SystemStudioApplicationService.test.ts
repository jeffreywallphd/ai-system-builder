import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { SystemStudioApplicationService } from "../SystemStudioApplicationService";
import { SystemStudioIdentity } from "../../../domain/system-studio/SystemAssetDomain";
import { AssetVersion as AssetVersionEntity } from "../../../domain/assets/AssetVersion";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";

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

const contractResolver = new CompositionAssetContractResolver();

function createPublishedVersion(input: {
  assetId: string;
  versionId: string;
  taxonomy: { structuralKind: "atomic" | "composite" | "system"; semanticRole: string; behaviorKind: string };
  content?: string;
}): AssetVersion {
  return new AssetVersionEntity({
    assetId: input.assetId,
    versionId: input.versionId,
    metadata: {
      metadata: {
        title: `${input.assetId} draft`,
        tags: [input.taxonomy.semanticRole],
        taxonomy: input.taxonomy,
        contract: contractResolver.resolveContractForTaxonomy(input.taxonomy as never),
        provenance: {
          sourceType: "generated",
          sourceLabel: "seed",
        },
      },
      dependencies: [],
      content: input.content ?? "{}",
      lifecycleStatus: "published",
    },
  });
}

describe("SystemStudioApplicationService", () => {
  it("reuses shared initialize/create/validate/publish flow for system assets with atomic/composite children", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
    }));
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v1",
      taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
    }));

    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new SystemStudioApplicationService(studioShell, repository);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createSystemDraft({
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System Root",
      content: JSON.stringify({
        systemSpec: {
          components: [
            { componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" },
            { componentKind: "composite", alias: "flow", assetId: "asset:workflow", versionId: "asset:workflow:v1" },
          ],
        },
      }),
      dependencies: [
        { assetId: "asset:model", versionId: "asset:model:v1" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
      ],
    });

    expect(ensure.studio.id).toBe(SystemStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("system");
    expect(created.draft.metadata.contract?.version).toBe("1.1.0");

    const validation = await service.validateSystemDraft({ draftId: created.draft.id });
    expect(validation.issues.filter((entry) => entry.code !== "contract-mismatch")).toHaveLength(0);

    const published = await service.publishSystemDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "asset:system-root:v1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("asset:system-root:v1");
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["asset:system-root:v1"]);
  });

  it("supports nested system composition as first-class through application publish path", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
    }));
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "system:child",
      versionId: "system:child:v1",
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      content: JSON.stringify({
        systemSpec: {
          components: [
            { componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" },
          ],
        },
      }),
    }));

    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new SystemStudioApplicationService(studioShell, repository);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createSystemDraft({
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System Root",
      content: JSON.stringify({
        systemSpec: {
          components: [
            { componentKind: "system", alias: "child", assetId: "system:child", versionId: "system:child:v1" },
          ],
          nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
        },
      }),
      dependencies: [{ assetId: "system:child", versionId: "system:child:v1" }],
    });

    const validation = await service.validateSystemDraft({ draftId: created.draft.id });
    expect(validation.issues.filter((entry) => entry.code !== "contract-mismatch")).toHaveLength(0);

    const published = await service.publishSystemDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "asset:system-root:v2",
    });

    expect(published.draft.metadata.taxonomy?.semanticRole).toBe("system");
    expect(published.version.versionId).toBe("asset:system-root:v2");
  });

  it("exercises recursive publish enforcement and blocks unresolved nested system dependencies", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new SystemStudioApplicationService(studioShell, repository);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createSystemDraft({
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System Root",
      content: JSON.stringify({
        systemSpec: {
          components: [
            { componentKind: "system", alias: "missing", assetId: "system:missing", versionId: "system:missing:v1" },
          ],
        },
      }),
      dependencies: [{ assetId: "system:missing", versionId: "system:missing:v1" }],
    });

    const validation = await service.validateSystemDraft({ draftId: created.draft.id });
    expect(validation.issues.map((entry) => entry.code)).toContain("system-child-reference-missing");

    await expect(service.publishSystemDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "asset:system-root:invalid",
    })).rejects.toThrow("system-child-reference-missing");
  });

  it("adds/removes/reorders atomic/composite/system child selections through system studio orchestration", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
    }));
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v1",
      taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
    }));
    await repository.saveAssetVersion(createPublishedVersion({
      assetId: "system:child",
      versionId: "system:child:v1",
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      content: JSON.stringify({ systemSpec: { components: [] } }),
    }));
    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new SystemStudioApplicationService(studioShell, repository);
    const ensure = await service.ensureStudioInitialized();
    const created = await service.createSystemDraft({
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System Root",
      content: JSON.stringify({ systemSpec: { components: [] } }),
    });

    await service.addSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model-a" },
    });
    await service.addSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v1", alias: "flow-a" },
    });
    await service.addSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: { componentKind: "system", assetId: "system:child", versionId: "system:child:v1", alias: "child-a" },
    });

    await service.reorderSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      componentAssetId: "system:child",
      componentVersionId: "system:child:v1",
      toIndex: 0,
    });

    await service.removeSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      componentAssetId: "asset:workflow",
      componentVersionId: "asset:workflow:v1",
    });

    const loaded = await studioShell.loadAssetDraft({ studioId: SystemStudioIdentity.defaultStudioId, draftId: created.draft.id });
    expect(loaded).toBeDefined();
    const spec = JSON.parse(loaded!.draft.content) as { readonly systemSpec?: { readonly components?: ReadonlyArray<{ readonly assetId: string }> } };
    expect(spec.systemSpec?.components?.map((component) => component.assetId)).toEqual(["system:child", "asset:model"]);
    expect(loaded!.draft.dependencies.map((entry) => entry.assetId).sort()).toEqual(["asset:model", "system:child"]);
  });

  it("surfaces invalid/cyclic multi-level selection through existing validation/publish path", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-root"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new SystemStudioApplicationService(studioShell, repository);
    const ensure = await service.ensureStudioInitialized();
    const created = await service.createSystemDraft({
      sessionId: ensure.session.id,
      draftId: "draft-root",
      title: "System Root",
      content: JSON.stringify({ systemSpec: { components: [] } }),
    });

    await service.addSystemChildComponent({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      component: { componentKind: "system", assetId: "system:missing", versionId: "system:missing:v1", alias: "missing" },
    });

    const validation = await service.validateSystemDraft({ draftId: created.draft.id });
    expect(validation.issues.map((entry) => entry.code)).toContain("system-child-reference-missing");

    await expect(service.publishSystemDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "asset:system-root:invalid-selection",
    })).rejects.toThrow("system-child-reference-missing");
  });
});
