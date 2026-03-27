import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import { AssetDraftLifecycleStatuses, createAssetSession, createStudio } from "../../../domain/studio-shell/StudioShellDomain";
import { DefaultStudioShellApplicationService } from "../DefaultStudioShellApplicationService";
import {
  StudioShellConflictError,
  StudioShellInvalidLifecycleTransitionError,
  StudioShellInvalidRequestError,
  StudioShellNotFoundError,
} from "../StudioShellApplicationErrors";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> {
    this.studios.set(studio.id, studio);
    return studio;
  }

  async getStudio(studioId: string): Promise<Studio | undefined> {
    return this.studios.get(studioId);
  }

  async saveSession(session: AssetSession): Promise<AssetSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<AssetSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> {
    return [...this.sessions.values()].filter((session) => session.studioId === studioId);
  }

  async saveDraft(draft: AssetDraft): Promise<AssetDraft> {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(draftId: string): Promise<AssetDraft | undefined> {
    return this.drafts.get(draftId);
  }

  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> {
    return [...this.drafts.values()].filter((draft) => draft.sessionId === sessionId);
  }

  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> {
    this.versions.set(version.versionId, version);
    return version;
  }

  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> {
    return this.versions.get(versionId);
  }

  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((version) => version.assetId.value === assetId);
  }
}

describe("DefaultStudioShellApplicationService", () => {
  it("initializes a studio with an active session", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository, ((prefix) => `${prefix}-1`));

    const result = await service.initializeStudio({
      studioId: "studio-a",
      name: "Studio A",
    });

    expect(result.studio.id).toBe("studio-a");
    expect(result.studio.activeSessionId).toBe("session-1");
    expect(result.activeSession.id).toBe("session-1");
  });

  it("creates and updates drafts via session orchestration", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1", "draft-2"];
    const service = new DefaultStudioShellApplicationService(repository, (() => idQueue.shift() ?? "generated"));

    await service.initializeStudio({ studioId: "studio-b", name: "Studio B" });

    const created = await service.createAssetDraft({
      studioId: "studio-b",
      sessionId: "session-1",
      content: "v1",
      metadata: {
        title: "Draft",
        tags: ["authoring"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "dynamic",
        },
      },
      dependencies: [
        { assetId: "asset:seed", versionId: "asset:seed:v1" },
        { assetId: "asset:seed", versionId: "asset:seed:v1" },
      ],
    });

    const updatedTaxonomy = await service.updateAssetDraft({
      studioId: "studio-b",
      sessionId: "session-1",
      draftId: created.draft.id,
      content: "v2",
      metadataPatch: {
        title: "Draft V2",
        tags: ["authoring", "updated"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      },
    });

    const updatedContract = await service.updateAssetDraft({
      studioId: "studio-b",
      sessionId: "session-1",
      draftId: created.draft.id,
      metadataPatch: {
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
      },
    });

    expect(created.session.currentDraftId).toBe("draft-1");
    expect(created.draft.dependencies).toEqual([{ assetId: "asset:seed", versionId: "asset:seed:v1" }]);
    expect(updatedTaxonomy.draft.revision).toBe(2);
    expect(updatedTaxonomy.draft.content).toBe("v2");
    expect(updatedTaxonomy.draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(updatedTaxonomy.draft.metadata.contract).toBeUndefined();
    expect(updatedContract.draft.revision).toBe(3);
    expect(updatedContract.draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(updatedContract.draft.metadata.contract?.version).toBe("1.0.0");
    expect(updatedContract.session.draftIds).toEqual(["draft-1"]);
  });

  it("normalizes and persists taxonomy and contract on draft creation", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository, ((prefix) => `${prefix}-created`));
    await service.initializeStudio({ studioId: "studio-metadata", name: "Studio Metadata" });

    await service.createAssetDraft({
      studioId: "studio-metadata",
      sessionId: "session-created",
      content: "draft",
      metadata: {
        title: "  Draft With Metadata  ",
        tags: ["authoring", "authoring", " workflow "],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "dynamic",
        },
        contract: {
          version: " 2.0.0 ",
          parameters: [
            { id: "temperature", required: false },
            { id: "temperature", required: true, valueType: "number" },
          ],
        },
      },
    });

    const loaded = await service.loadAssetDraft({ studioId: "studio-metadata", draftId: "draft-created" });
    expect(loaded?.draft.metadata.title).toBe("Draft With Metadata");
    expect(loaded?.draft.metadata.tags).toEqual(["authoring", "workflow"]);
    expect(loaded?.draft.metadata.taxonomy?.behaviorKind).toBe("dynamic");
    expect(loaded?.draft.metadata.contract?.version).toBe("2.0.0");
    expect(loaded?.draft.metadata.contract?.parameters).toEqual([
      { id: "temperature", required: true, description: undefined, valueType: "number", defaultValue: undefined },
    ]);
  });

  it("normalizes and persists provenance through draft create and patch updates", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository, ((prefix) => `${prefix}-prov`));
    await service.initializeStudio({ studioId: "studio-provenance", name: "Studio Provenance" });

    const created = await service.createAssetDraft({
      studioId: "studio-provenance",
      sessionId: "session-prov",
      content: "draft",
      metadata: {
        title: "Provenance Draft",
        tags: ["source"],
        provenance: {
          creatorId: "  creator-1 ",
          sourceType: "uploaded",
          derivationContext: "  imported from workspace ",
          upstreamAssets: [
            { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
            { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
          ],
        },
      },
    });

    const updated = await service.updateAssetDraft({
      studioId: "studio-provenance",
      sessionId: "session-prov",
      draftId: created.draft.id,
      metadataPatch: {
        provenance: {
          creatorId: "editor-2",
          sourceType: "derived",
          upstreamAssets: [{ assetId: "asset:transform", versionId: "asset:transform:v3", relationship: "TRANSFORMED_FROM" }],
        },
      },
    });

    expect(created.draft.metadata.provenance?.creatorId).toBe("creator-1");
    expect(created.draft.metadata.provenance?.upstreamAssets).toEqual([
      { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
    ]);
    expect(updated.draft.metadata.provenance?.creatorId).toBe("editor-2");
    expect(updated.draft.metadata.provenance?.sourceType).toBe("derived");
    expect(updated.draft.metadata.provenance?.upstreamAssets).toEqual([
      { assetId: "asset:transform", versionId: "asset:transform:v3", relationship: "TRANSFORMED_FROM" },
    ]);
  });

  it("returns invalid request error when taxonomy combination is unsupported", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository, ((prefix) => `${prefix}-invalid-taxonomy`));
    await service.initializeStudio({ studioId: "studio-invalid", name: "Studio Invalid" });

    await expect(service.createAssetDraft({
      studioId: "studio-invalid",
      sessionId: "session-invalid-taxonomy",
      content: "draft",
      metadata: {
        title: "Draft",
        tags: [],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      },
    })).rejects.toBeInstanceOf(StudioShellInvalidRequestError);
  });

  it("updates dependency capture through bounded orchestration flow", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, (() => idQueue.shift() ?? "generated"));
    await service.initializeStudio({ studioId: "studio-dependencies", name: "Studio Dependencies" });
    const created = await service.createAssetDraft({
      studioId: "studio-dependencies",
      sessionId: "session-1",
      content: "v1",
      metadata: { title: "Draft", tags: [] },
    });

    const updatedDependencies = await service.updateAssetDraftDependencies({
      studioId: "studio-dependencies",
      sessionId: "session-1",
      draftId: created.draft.id,
      dependencies: [
        { assetId: " asset:a ", versionId: " asset:a:v1 " },
        { assetId: "asset:a", versionId: "asset:a:v1" },
        { assetId: "asset:b" },
      ],
    });

    expect(updatedDependencies.draft.dependencies).toEqual([
      { assetId: "asset:a", versionId: "asset:a:v1" },
      { assetId: "asset:b", versionId: undefined },
    ]);
    expect(updatedDependencies.draft.revision).toBe(2);
    expect(updatedDependencies.draft.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.draft);
  });

  it("creates version snapshots from studio drafts and returns version history", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, (() => idQueue.shift() ?? "generated"));

    await service.initializeStudio({ studioId: "studio-versioning", name: "Studio Versioning" });
    const draft = await service.createAssetDraft({
      studioId: "studio-versioning",
      sessionId: "session-1",
      content: "v1",
      metadata: {
        title: "Versioned Draft",
        tags: ["authoring"],
        provenance: {
          creatorId: "creator-a",
          sourceType: "derived",
          upstreamAssets: [{ assetId: "asset:seed", versionId: "asset:seed:v1", relationship: "DERIVED_FROM" }],
        },
      },
    });

    await expect(service.publishAssetDraftVersion({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
    })).rejects.toBeInstanceOf(StudioShellInvalidLifecycleTransitionError);

    await service.transitionAssetDraftLifecycle({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    const version1 = await service.publishAssetDraftVersion({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
      versionId: "version-1",
    });
    await service.transitionAssetDraftLifecycle({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.draft,
    });
    await service.transitionAssetDraftLifecycle({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    const version2 = await service.publishAssetDraftVersion({
      studioId: "studio-versioning",
      sessionId: "session-1",
      draftId: draft.draft.id,
      versionId: "version-2",
      versionLabel: "v2",
    });
    const history = await service.listAssetDraftVersionHistory({
      studioId: "studio-versioning",
      draftId: draft.draft.id,
    });

    expect(version1.version.versionId).toBe("version-1");
    expect(version1.version.createdBy).toBe("creator-a");
    expect(version1.version.upstreamVersionIds).toEqual(["asset:seed:v1"]);
    expect(version2.version.parentVersionId).toBe("version-1");
    expect(version2.draft.revision).toBe(1);
    expect(version2.draft.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(version2.draft.publishedVersionIds).toEqual(["version-1", "version-2"]);
    expect(history.versions.map((entry) => entry.versionId)).toEqual(["version-1", "version-2"]);
  });

  it("maps invalid lifecycle transitions to typed application failures", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, (() => idQueue.shift() ?? "generated"));

    await service.initializeStudio({ studioId: "studio-lifecycle", name: "Studio Lifecycle" });
    const created = await service.createAssetDraft({
      studioId: "studio-lifecycle",
      sessionId: "session-1",
      content: "v1",
      metadata: { title: "Draft", tags: [] },
    });

    await expect(service.transitionAssetDraftLifecycle({
      studioId: "studio-lifecycle",
      sessionId: "session-1",
      draftId: created.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.published,
    })).rejects.toBeInstanceOf(StudioShellInvalidLifecycleTransitionError);
  });

  it("rejects duplicate immutable version ids", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, (() => idQueue.shift() ?? "generated"));
    await service.initializeStudio({ studioId: "studio-conflict", name: "Studio Conflict" });
    const draft = await service.createAssetDraft({
      studioId: "studio-conflict",
      sessionId: "session-1",
      content: "v1",
      metadata: { title: "Draft", tags: [] },
    });

    await service.transitionAssetDraftLifecycle({
      studioId: "studio-conflict",
      sessionId: "session-1",
      draftId: draft.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    await service.publishAssetDraftVersion({
      studioId: "studio-conflict",
      sessionId: "session-1",
      draftId: draft.draft.id,
      versionId: "asset:studio:version:v1",
    });

    await expect(service.publishAssetDraftVersion({
      studioId: "studio-conflict",
      sessionId: "session-1",
      draftId: draft.draft.id,
      versionId: "asset:studio:version:v1",
    })).rejects.toBeInstanceOf(StudioShellConflictError);
  });

  it("returns undefined when loading missing draft for an existing studio", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository);

    await repository.saveStudio(createStudio({ id: "studio-c", name: "Studio C" }));

    const result = await service.loadAssetDraft({
      studioId: "studio-c",
      draftId: "missing",
    });

    expect(result).toBeUndefined();
  });

  it("throws not-found when draft session has been removed", async () => {
    const repository = new InMemoryStudioShellRepository();
    const service = new DefaultStudioShellApplicationService(repository, (() => "draft-1"));
    const studio = createStudio({ id: "studio-d", name: "Studio D" });
    const session = createAssetSession({ id: "session-d", studioId: studio.id });

    await repository.saveStudio(studio);
    await repository.saveDraft({
      id: "draft-d",
      studioId: studio.id,
      sessionId: session.id,
      content: "content",
      metadata: { title: "Draft D", tags: [] },
      dependencies: Object.freeze([]),
      lifecycleStatus: AssetDraftLifecycleStatuses.draft,
      revision: 1,
      publishedVersionIds: Object.freeze([]),
      createdAt: new Date("2026-03-27T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-27T00:00:00.000Z").toISOString(),
    });

    await expect(service.loadAssetDraft({ studioId: studio.id, draftId: "draft-d" })).rejects.toBeInstanceOf(StudioShellNotFoundError);
  });
});
