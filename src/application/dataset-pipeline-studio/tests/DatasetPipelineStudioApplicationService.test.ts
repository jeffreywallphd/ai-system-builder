import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "@domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { DatasetPipelineStudioApplicationService } from "../DatasetPipelineStudioApplicationService";
import { DatasetPipelineStudioIdentity } from "@domain/dataset-pipeline-studio/DatasetPipelineStudioDomain";

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

describe("DatasetPipelineStudioApplicationService", () => {
  it("authors dataset-pipeline drafts with composite taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new DatasetPipelineStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createDatasetPipelineDraft({
      sessionId: ensure.session.id,
      title: "Dataset Pipeline Draft",
      content: '{"datasetPipelineSpec":{"sources":[{"datasetRef":"dataset:raw:v1","ingestion":"batch"}],"steps":[{"id":"clean-null-records","kind":"data-cleaning"},{"id":"normalize-fields","kind":"dataset-transformation"},{"id":"schema-check","kind":"data-validation"}],"publishTarget":"dataset:prepared"}}',
      creatorId: "author-1",
      tags: ["source-ingestion", "data-cleaning", "dataset-transformation", "data-validation"],
      behaviorKind: "iterative",
      dependencies: [
        { assetId: "asset:dataset-raw", versionId: "asset:dataset-raw:v1" },
        { assetId: "asset:dataset-validation-profile", versionId: "asset:dataset-validation-profile:v2" },
      ],
    });

    expect(ensure.studio.id).toBe(DatasetPipelineStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("composite");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("dataset-pipeline");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("iterative");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "pipelineMode")?.defaultValue).toBe("iterative");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual([
      "dataset-pipeline",
      "source-ingestion",
      "data-cleaning",
      "dataset-transformation",
      "data-validation",
    ]);
  });

  it("reuses shared lifecycle/version flow when publishing dataset-pipeline drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new DatasetPipelineStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createDatasetPipelineDraft({
      sessionId: ensure.session.id,
      title: "Dataset Pipeline Draft",
      content: "{}",
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v9" }],
    });

    const published = await service.publishDatasetPipelineDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "dataset-pipeline-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("dataset-pipeline-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["dataset-pipeline-version-1"]);
  });

  it("blocks publish when dataset-pipeline draft taxonomy semantic role drifts outside composite dataset-pipeline expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new DatasetPipelineStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createDatasetPipelineDraft({
      sessionId: ensure.session.id,
      title: "Dataset Pipeline",
      content: "{}",
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1" }],
    });

    await studioShell.updateAssetDraft({
      studioId: DatasetPipelineStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "composite", semanticRole: "training-recipe", behaviorKind: "deterministic" },
      },
    });

    await expect(service.publishDatasetPipelineDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "dataset-pipeline-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });
});

