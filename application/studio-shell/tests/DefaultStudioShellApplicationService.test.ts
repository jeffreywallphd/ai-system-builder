import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import { createAssetSession, createStudio } from "../../../domain/studio-shell/StudioShellDomain";
import { DefaultStudioShellApplicationService } from "../DefaultStudioShellApplicationService";
import { StudioShellNotFoundError } from "../StudioShellApplicationErrors";

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

    const updated = await service.updateAssetDraft({
      studioId: "studio-b",
      sessionId: "session-1",
      draftId: created.draft.id,
      content: "v2",
      metadata: {
        title: "Draft V2",
        tags: ["authoring", "updated"],
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
      },
    });

    expect(created.session.currentDraftId).toBe("draft-1");
    expect(updated.draft.revision).toBe(2);
    expect(updated.draft.content).toBe("v2");
    expect(updated.draft.metadata.taxonomy).toBeUndefined();
    expect(updated.draft.metadata.contract?.version).toBe("1.0.0");
    expect(updated.session.draftIds).toEqual(["draft-1"]);
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
