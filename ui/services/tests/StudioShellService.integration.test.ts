import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { DesktopStudioShellBridge } from "../../../electron/shared/DesktopContracts";
import { StudioShellBackendApi } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { SqliteStudioShellRepository } from "../../../infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import { AssetDraftLifecycleStatuses } from "../../../domain/studio-shell/StudioShellDomain";
import { StudioShellService } from "../StudioShellService";

const createdRoots: string[] = [];

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function installBridge(api: StudioShellBackendApi): void {
  const bridge: DesktopStudioShellBridge = {
    initializeStudio(studioId: string, name: string) {
      return api.initializeStudio(studioId, name).then((response) => JSON.stringify(response));
    },
    loadSnapshot(studioId: string) {
      return api.loadSnapshot(studioId).then((response) => JSON.stringify(response));
    },
    startSession(studioId: string) {
      return api.startSession(studioId).then((response) => JSON.stringify(response));
    },
    createDraft(requestJson: string) {
      return api.createDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDraft(requestJson: string) {
      return api.updateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDependencies(requestJson: string) {
      return api.updateDependencies(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    transitionLifecycle(requestJson: string) {
      return api.transitionLifecycle(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    publishVersion(requestJson: string) {
      return api.publishVersion(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    validateDraft(requestJson: string) {
      return api.validateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
  };

  (globalThis as { window?: Window }).window = {
    aiLoomDesktop: {
      studioShell: bridge,
    },
  } as Window;

}

describe("StudioShellService integration", () => {

  it("supports Dataset Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "dataset-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-datasets", "Dataset Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      content: '{"datasetSpec":{"format":"jsonl"}}',
      metadata: {
        title: "Dataset Asset Draft",
        tags: ["dataset", "studio-shell"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "dataset",
          behaviorKind: "none",
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "dataset-studio",
        },
      },
      dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v1" }],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-datasets:v1",
      versionLabel: "v1",
      createdBy: "dataset-curator",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("dataset");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-datasets:v1"]);

    repository.dispose();
  });
  it("executes the Studio Shell vertical flow through bridge -> backend -> application -> sqlite persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-shell-main", "Studio Shell");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      content: "{\"prompt\":\"first\"}",
      metadata: {
        title: "Studio Shell Draft",
        tags: ["studio-shell"],
      },
      dependencies: [{ assetId: "asset:seed" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();

    const updated = await service.updateDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      content: "{\"prompt\":\"publishable\"}",
      metadataPatch: {
        title: "Studio Shell Draft v2",
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
          creatorId: "author-1",
          sourceType: "generated",
        },
      },
    });
    expect(updated.ok).toBeTrue();

    const dependencies = await service.updateDependencies({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      dependencies: [{ assetId: "asset:seed", versionId: "asset:seed:v1" }],
    });
    expect(dependencies.ok).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-shell-main:v1",
      versionLabel: "v1",
      createdBy: "author-1",
      upstreamVersionIds: ["asset:seed:v1"],
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.draft?.lastPublishedVersionId).toBe("asset:studio-shell-main:v1");

    const issues = await service.validateDraft("studio-shell-main", draftId!);
    expect(issues.ok).toBeTrue();
    expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
    expect(issues.data?.some((entry) => entry.code === "version-history-empty")).toBeFalse();

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const reloadedSnapshot = await service.loadSnapshot("studio-shell-main");
    expect(reloadedSnapshot.ok).toBeTrue();
    expect(reloadedSnapshot.data?.draft?.draftId).toBe(draftId);
    expect(reloadedSnapshot.data?.draft?.content).toBe("{\"prompt\":\"publishable\"}");
    expect(reloadedSnapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);

    reopenedRepository.dispose();
  });
});
