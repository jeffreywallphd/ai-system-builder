import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { WorkflowStudioApplicationService } from "../WorkflowStudioApplicationService";
import { createEmptyWorkflowDraft, serializeWorkflowDraft, WorkflowStudioIdentity } from "../../../domain/workflow-studio/WorkflowStudioDomain";

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

describe("WorkflowStudioApplicationService", () => {
  it("authors workflow drafts with composite workflow taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow Orchestrator Draft",
      content: serializeWorkflowDraft(createEmptyWorkflowDraft()),
      creatorId: "author-1",
      tags: ["orchestrator"],
      behaviorKind: "iterative",
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    expect(ensure.studio.id).toBe(WorkflowStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("composite");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("iterative");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "workflowMode")?.defaultValue).toBe("iterative");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual(["workflow", "orchestrator"]);
  });

  it("reuses shared lifecycle/version flow when publishing workflow drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow Draft",
      content: "{}",
      dependencies: [{ assetId: "asset:tool-chain", versionId: "asset:tool-chain:v1" }],
    });

    const published = await service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("workflow-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["workflow-version-1"]);
  });

  it("blocks publish when workflow draft taxonomy semantic role drifts outside composite workflow expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: "{}",
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await studioShell.updateAssetDraft({
      studioId: WorkflowStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "composite", semanticRole: "tool-chain", behaviorKind: "deterministic" },
      },
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });

  it("blocks publish when workflow draft dependencies are unpinned", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: "{}",
      dependencies: [{ assetId: "asset:model" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-unpinned",
    })).rejects.toThrow("dependency-version-unpinned");
  });

  it("blocks publish when canonical workflow draft content fails domain validation", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: JSON.stringify({
        triggers: [
          {
            id: "trigger-temporal",
            kind: "temporal",
            type: "schedule",
            config: {},
          },
        ],
        inputs: [],
        steps: [],
        outputs: [],
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-invalid-content",
    })).rejects.toThrow("Workflow draft content is malformed");
  });

  it("blocks publish when workflow asset references violate canonical taxonomy expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow taxonomy mismatch",
      content: JSON.stringify({
        triggers: [],
        inputs: [{
          id: "input-dataset",
          type: "dataset",
          sourceType: "dataset-asset",
          asset: {
            assetId: "asset:dataset-customers",
            taxonomy: {
              structuralKind: "atomic",
              semanticRole: "tool",
              behaviorKind: "deterministic",
            },
          },
        }],
        steps: [],
        outputs: [],
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-taxonomy-mismatch",
    })).rejects.toThrow("input-malformed");
  });
});
