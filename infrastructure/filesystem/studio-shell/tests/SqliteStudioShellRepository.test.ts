import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import { DefaultStudioShellApplicationService } from "../../../../application/studio-shell/DefaultStudioShellApplicationService";
import { StudioShellBackendApi } from "../../../api/studio-shell/StudioShellBackendApi";
import { SqliteStudioShellRepository } from "../SqliteStudioShellRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteStudioShellRepository", () => {
  it("round-trips studio shell aggregates across persistence and rehydration", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-"));
    createdRoots.push(root);
    const repository = new SqliteStudioShellRepository(path.join(root, "studio-shell.sqlite"));
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");

    await service.initializeStudio({ studioId: "studio-roundtrip", name: "Roundtrip" });
    const created = await service.createAssetDraft({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      content: "draft-v1",
      metadata: {
        title: "  Draft Roundtrip  ",
        tags: ["authoring", "authoring"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
        provenance: {
          creatorId: "creator-1",
          sourceType: "derived",
          upstreamAssets: [{ assetId: "asset:seed", versionId: "asset:seed:v1", relationship: "DERIVED_FROM" }],
        },
      },
      dependencies: [
        { assetId: "asset:dependency", versionId: "asset:dependency:v1" },
        { assetId: "asset:dependency", versionId: "asset:dependency:v1" },
      ],
    });

    await service.transitionAssetDraftLifecycle({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      draftId: created.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    await service.publishAssetDraftVersion({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      draftId: created.draft.id,
      versionId: "asset:studio-roundtrip:v1",
    });

    const loadedDraft = await repository.getDraft(created.draft.id);
    const loadedStudio = await repository.getStudio("studio-roundtrip");
    const loadedSession = await repository.getSession("session-1");
    const versions = await repository.listAssetVersionsByAssetId(created.draft.assetId);

    expect(loadedStudio?.id).toBe("studio-roundtrip");
    expect(loadedSession?.currentDraftId).toBe(created.draft.id);
    expect(loadedDraft?.metadata.title).toBe("Draft Roundtrip");
    expect(loadedDraft?.dependencies).toEqual([{ assetId: "asset:dependency", versionId: "asset:dependency:v1" }]);
    expect(loadedDraft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(loadedDraft?.publishedVersionIds).toEqual(["asset:studio-roundtrip:v1"]);
    expect(versions.map((entry) => entry.versionId)).toEqual(["asset:studio-roundtrip:v1"]);

    repository.dispose();
  });

  it("supports backend snapshot and version history after repository reload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");

    {
      const repository = new SqliteStudioShellRepository(databasePath);
      const idQueue = ["session-1", "draft-1"];
      const service = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");

      await service.initializeStudio({ studioId: "studio-reload", name: "Reload" });
      await service.createAssetDraft({
        studioId: "studio-reload",
        sessionId: "session-1",
        content: "initial",
        metadata: { title: "Reload Draft", tags: ["reload"] },
      });

      repository.dispose();
    }

    const repository = new SqliteStudioShellRepository(databasePath);
    const api = new StudioShellBackendApi(repository);

    const snapshot = await api.loadSnapshot("studio-reload");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.content).toBe("initial");
    expect(snapshot.data?.validationIssues.some((entry) => entry.code === "taxonomy-missing")).toBeTrue();

    repository.dispose();
  });
});
