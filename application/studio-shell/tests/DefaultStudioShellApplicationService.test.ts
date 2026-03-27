import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import { createAssetSession, createStudio } from "../../../domain/studio-shell/StudioShellDomain";
import { DefaultStudioShellApplicationService } from "../DefaultStudioShellApplicationService";
import { StudioShellInvalidRequestError, StudioShellNotFoundError } from "../StudioShellApplicationErrors";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();

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
      revision: 1,
      createdAt: new Date("2026-03-27T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-27T00:00:00.000Z").toISOString(),
    });

    await expect(service.loadAssetDraft({ studioId: studio.id, draftId: "draft-d" })).rejects.toBeInstanceOf(StudioShellNotFoundError);
  });
});
