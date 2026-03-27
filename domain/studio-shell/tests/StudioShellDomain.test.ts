import { describe, expect, it } from "bun:test";
import {
  applyAssetMetadataPatch,
  AssetSessionStatuses,
  attachDraftToSession,
  closeAssetSession,
  createAssetDraft,
  createAssetSession,
  createStudio,
  publishAssetDraftVersion,
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
        provenance: {
          creatorId: "  author-1  ",
          sourceType: "uploaded",
          derivationContext: "  imported from docs  ",
          upstreamAssets: [
            { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
            { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
          ],
        },
      },
    });

    expect(draft.metadata.title).toBe("Session Draft");
    expect(draft.metadata.tags).toEqual(["alpha", "beta"]);
    expect(draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(draft.metadata.contract?.version).toBe("v1");
    expect(draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(draft.metadata.provenance?.upstreamAssets).toEqual([
      { assetId: "asset:source", versionId: "asset:source:v1", relationship: "DERIVED_FROM" },
    ]);
  });

  it("applies taxonomy metadata patch while preserving contract metadata", () => {
    const studio = createStudio({ id: "studio-taxonomy", name: "Authoring Studio" });
    const session = createAssetSession({ id: "session-taxonomy", studioId: studio.id });
    const draft = createAssetDraft({
      id: "draft-taxonomy",
      studioId: studio.id,
      session,
      content: "draft",
      metadata: {
        title: "Draft",
        tags: ["authoring"],
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
      },
    });

    const updated = updateAssetDraft(draft, session, {
      metadataPatch: {
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "dynamic",
        },
      },
    });

    expect(updated.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(updated.metadata.contract?.version).toBe("1.0.0");
  });

  it("applies contract metadata patch while preserving taxonomy metadata", () => {
    const metadata = applyAssetMetadataPatch(
      {
        title: "Draft",
        tags: ["authoring"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      },
      {
        contract: {
          version: "2.0.0",
          parameters: [{ id: "max_tokens", required: false }],
        },
      },
    );

    expect(metadata.taxonomy?.behaviorKind).toBe("deterministic");
    expect(metadata.contract?.version).toBe("2.0.0");
  });

  it("applies provenance metadata patch while preserving taxonomy and contract", () => {
    const metadata = applyAssetMetadataPatch(
      {
        title: "Draft",
        tags: ["authoring"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
      },
      {
        provenance: {
          creatorId: "creator-1",
          sourceType: "generated",
          sourceLabel: "studio-shell",
          upstreamAssets: [{ assetId: "asset:seed", versionId: "asset:seed:v2", relationship: "GENERATED_FROM" }],
        },
      },
    );

    expect(metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(metadata.contract?.version).toBe("1.0.0");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.upstreamAssets?.[0]?.relationship).toBe("GENERATED_FROM");
  });

  it("rejects invalid taxonomy structural/semantic/behavior combinations", () => {
    const studio = createStudio({ id: "studio-invalid-taxonomy", name: "Authoring Studio" });
    const session = createAssetSession({ id: "session-invalid-taxonomy", studioId: studio.id });

    expect(() => createAssetDraft({
      id: "draft-invalid-taxonomy",
      studioId: studio.id,
      session,
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
    })).toThrow("Asset metadata taxonomy combination");
  });

  it("rejects unsupported provenance source type and lineage relationship", () => {
    const studio = createStudio({ id: "studio-invalid-prov", name: "Authoring Studio" });
    const session = createAssetSession({ id: "session-invalid-prov", studioId: studio.id });

    expect(() => createAssetDraft({
      id: "draft-invalid-prov",
      studioId: studio.id,
      session,
      content: "draft",
      metadata: {
        title: "Draft",
        tags: [],
        provenance: {
          sourceType: "invalid" as "uploaded",
        },
      },
    })).toThrow("sourceType");

    expect(() => createAssetDraft({
      id: "draft-invalid-prov-edge",
      studioId: studio.id,
      session,
      content: "draft",
      metadata: {
        title: "Draft",
        tags: [],
        provenance: {
          sourceType: "uploaded",
          upstreamAssets: [{ assetId: "asset:a", relationship: "unknown" as "DERIVED_FROM" }],
        },
      },
    })).toThrow("relationship");
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

  it("publishes immutable asset versions while keeping draft revision semantics separate", () => {
    const studio = createStudio({ id: "studio-version", name: "Versioned Studio" });
    const session = createAssetSession({ id: "session-version", studioId: studio.id });
    const draft = createAssetDraft({
      id: "draft-version",
      assetId: "asset:studio:draft-version",
      studioId: studio.id,
      session,
      content: "v1",
      metadata: {
        title: "Draft",
        tags: ["authoring"],
        provenance: {
          creatorId: "author-1",
          sourceType: "derived",
          upstreamAssets: [{ assetId: "asset:upstream", versionId: "asset:upstream:v1", relationship: "DERIVED_FROM" }],
        },
      },
    });

    const first = publishAssetDraftVersion({
      draft,
      session,
      versionId: "asset:studio:draft-version:v1",
      versionLabel: "v1",
    });
    const second = publishAssetDraftVersion({
      draft: first.draft,
      session,
      versionId: "asset:studio:draft-version:v2",
      versionLabel: "v2",
    });

    expect(first.draft.revision).toBe(1);
    expect(first.version.assetId.value).toBe("asset:studio:draft-version");
    expect(first.version.createdBy).toBe("author-1");
    expect(first.version.upstreamVersionIds).toEqual(["asset:upstream:v1"]);
    expect(second.version.parentVersionId).toBe("asset:studio:draft-version:v1");
    expect(second.draft.publishedVersionIds).toEqual([
      "asset:studio:draft-version:v1",
      "asset:studio:draft-version:v2",
    ]);
  });
});
