import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "@domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { TrainingRecipeStudioApplicationService } from "../TrainingRecipeStudioApplicationService";
import { TrainingRecipeStudioIdentity } from "@domain/training-recipe-studio/TrainingRecipeStudioDomain";

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

describe("TrainingRecipeStudioApplicationService", () => {
  it("authors training-recipe drafts with composite taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new TrainingRecipeStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createTrainingRecipeDraft({
      sessionId: ensure.session.id,
      title: "Training Recipe Draft",
      content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v2\"],\"configProfileRef\":\"config-profile:runtime:v3\",\"executionKind\":\"local-gradient-training\",\"flow\":{\"epochs\":3,\"batchSize\":8}}}",
      creatorId: "author-1",
      tags: ["model-training", "fine-tuning", "runtime-config"],
      dependencies: [
        { assetId: "asset:base-model", versionId: "asset:base-model:v1" },
        { assetId: "asset:training-dataset", versionId: "asset:training-dataset:v2" },
        { assetId: "asset:training-runtime-config", versionId: "asset:training-runtime-config:v1" },
      ],
    });

    expect(ensure.studio.id).toBe(TrainingRecipeStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("composite");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("training-recipe");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("deterministic");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "executionTarget")).toBeDefined();
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual([
      "training-recipe",
      "model-training",
      "fine-tuning",
      "runtime-config",
    ]);
  });

  it("reuses shared lifecycle/version flow when publishing training-recipe drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new TrainingRecipeStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createTrainingRecipeDraft({
      sessionId: ensure.session.id,
      title: "Training Recipe Draft",
      content: "{}",
      dependencies: [{ assetId: "asset:training-dataset", versionId: "asset:training-dataset:v9" }],
    });

    const published = await service.publishTrainingRecipeDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "training-recipe-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("training-recipe-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["training-recipe-version-1"]);
  });

  it("blocks publish when training-recipe draft taxonomy semantic role drifts outside composite training-recipe expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new TrainingRecipeStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createTrainingRecipeDraft({
      sessionId: ensure.session.id,
      title: "Training Recipe",
      content: "{}",
      dependencies: [{ assetId: "asset:training-dataset", versionId: "asset:training-dataset:v1" }],
    });

    await studioShell.updateAssetDraft({
      studioId: TrainingRecipeStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "composite", semanticRole: "dataset-pipeline", behaviorKind: "deterministic" },
      },
    });

    await expect(service.publishTrainingRecipeDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "training-recipe-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });
});

