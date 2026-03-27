import { describe, expect, it } from "bun:test";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";

describe("StudioShellBackendApi", () => {
  it("projects the same validation issue structure for atomic model/dataset/tool drafts", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const drafts: Array<{ studioId: string; semanticRole: "model" | "dataset" | "tool"; behaviorKind: "none" | "conditional" }> = [
      { studioId: "studio-models", semanticRole: "model", behaviorKind: "none" },
      { studioId: "studio-datasets", semanticRole: "dataset", behaviorKind: "none" },
      { studioId: "studio-tools", semanticRole: "tool", behaviorKind: "conditional" },
    ];

    for (const entry of drafts) {
      const initialized = await api.initializeStudio(entry.studioId, entry.studioId);
      const sessionId = initialized.data!.activeSessionId!;
      await api.createDraft({
        studioId: entry.studioId,
        sessionId,
        content: "{}",
        metadata: {
          title: `${entry.semanticRole}-draft`,
          tags: [entry.semanticRole],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: entry.semanticRole,
            behaviorKind: entry.behaviorKind,
          },
          contract: {
            version: "1.0.0",
            input: { kind: "json-schema" },
            output: { kind: "json-schema" },
          },
          provenance: {
            sourceType: "generated",
            sourceLabel: `${entry.semanticRole}-studio`,
          },
        },
        dependencies: [],
      });

      const snapshot = await api.loadSnapshot(entry.studioId);
      const codes = (snapshot.data?.validationIssues ?? []).map((issue) => issue.code).sort();
      expect(codes).toEqual(["lifecycle-not-publish-ready", "version-history-empty"]);
    }
  });

  it("builds a bounded snapshot and validation issue projection for active draft surfaces", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const initialized = await api.initializeStudio("studio-shell-test", "Studio Shell Test");
    expect(initialized.ok).toBeTrue();
    expect(initialized.data?.activeSessionId).toBeDefined();

    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    await api.createDraft({
      studioId: "studio-shell-test",
      sessionId: sessionId!,
      content: "draft-body",
      metadata: {
        title: "Draft",
        tags: ["shell"],
      },
      dependencies: [{ assetId: "asset:seed" }],
    });

    const snapshot = await api.loadSnapshot("studio-shell-test");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.content).toBe("draft-body");
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "taxonomy-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "contract-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "provenance-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "dependency-version-unpinned")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "lifecycle-not-publish-ready")).toBeTrue();
  });

  it("maps publish gating and lifecycle failures as typed API errors", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-shell-lifecycle", "Lifecycle Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const created = await api.createDraft({
      studioId: "studio-shell-lifecycle",
      sessionId,
      content: "body",
      metadata: { title: "Draft", tags: [] },
    });
    const draftId = created.data!.draft!.draftId;

    const invalidPublish = await api.publishVersion({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
    });
    expect(invalidPublish.ok).toBeFalse();
    expect(invalidPublish.error?.code).toBe("invalid-lifecycle-transition");

    const transitioned = await api.transitionLifecycle({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(transitioned.ok).toBeTrue();

    const published = await api.publishVersion({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
    });
    expect(published.ok).toBeTrue();
    expect((published.data?.versions.length ?? 0) > 0).toBeTrue();
  });
});
