import { describe, expect, it } from "bun:test";
import {
  AssetSessionStatuses,
  attachDraftToSession,
  closeAssetSession,
  createAssetDraft,
  createAssetSession,
  createStudio,
  updateAssetDraft,
  withStudioSession,
} from "../StudioShellDomain";

describe("StudioShellDomain", () => {
  it("normalizes metadata while keeping taxonomy and contract separate", () => {
    const studio = createStudio({ id: "studio-1", name: "Authoring Studio" });
    const session = createAssetSession({ id: "session-1", studioId: studio.id });
    const draft = createAssetDraft({
      id: "draft-1",
      studioId: studio.id,
      session,
      content: "hello",
      metadata: {
        title: "  Session Draft  ",
        summary: "  Initial draft  ",
        tags: ["alpha", "alpha", "beta"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "v1",
          parameters: [{ id: "max_tokens", required: false }],
        },
      },
    });

    expect(draft.metadata.title).toBe("Session Draft");
    expect(draft.metadata.tags).toEqual(["alpha", "beta"]);
    expect(draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(draft.metadata.contract?.version).toBe("v1");
  });

  it("prevents draft mutation after session close", () => {
    const studio = createStudio({ id: "studio-2", name: "Authoring Studio" });
    const session = createAssetSession({ id: "session-2", studioId: studio.id });
    const draft = createAssetDraft({
      id: "draft-2",
      studioId: studio.id,
      session,
      content: "draft",
      metadata: { title: "Draft", tags: [] },
    });

    const closed = closeAssetSession(session);

    expect(() => updateAssetDraft(draft, closed, { content: "updated" })).toThrow(
      "Asset session 'session-2' is closed and cannot be mutated.",
    );
  });

  it("tracks draft lifecycle on session and revision updates", () => {
    const baseTime = new Date("2026-03-27T00:00:00.000Z");
    const studio = createStudio({ id: "studio-3", name: "Studio", now: baseTime });
    const session = createAssetSession({ id: "session-3", studioId: studio.id, now: baseTime });
    const draft = createAssetDraft({
      id: "draft-3",
      studioId: studio.id,
      session,
      content: "v1",
      metadata: { title: "Draft", tags: [] },
      now: baseTime,
    });
    const sessionWithDraft = attachDraftToSession(session, draft, new Date("2026-03-27T00:01:00.000Z"));
    const updated = updateAssetDraft(draft, sessionWithDraft, {
      content: "v2",
      now: new Date("2026-03-27T00:02:00.000Z"),
    });
    const studioWithSession = withStudioSession(studio, session.id, new Date("2026-03-27T00:03:00.000Z"));

    expect(sessionWithDraft.currentDraftId).toBe("draft-3");
    expect(sessionWithDraft.draftIds).toEqual(["draft-3"]);
    expect(updated.revision).toBe(2);
    expect(updated.content).toBe("v2");
    expect(studioWithSession.activeSessionId).toBe("session-3");
  });

  it("sets closedAt when creating closed sessions", () => {
    const closed = createAssetSession({ id: "session-closed", studioId: "studio", status: AssetSessionStatuses.closed });
    expect(closed.closedAt).toBeDefined();
  });
});
