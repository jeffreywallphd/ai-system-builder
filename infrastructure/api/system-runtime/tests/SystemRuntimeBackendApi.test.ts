import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../../../application/studio-shell/DefaultStudioShellApplicationService";
import { SystemStudioApplicationService } from "../../../../application/system-studio/SystemStudioApplicationService";
import { SystemStudioIdentity } from "../../../../domain/system-studio/SystemAssetDomain";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";

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

describe("SystemRuntimeBackendApi", () => {
  it("starts execution via draft and exposes status/trace/result projections", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");
    const systemService = new SystemStudioApplicationService(studioShell, repository);
    const runtimeApi = new SystemRuntimeBackendApi(repository);

    const ensured = await systemService.ensureStudioInitialized();
    const created = await systemService.createSystemDraft({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensured.session.id,
      draftId: "draft-1",
      title: "Runtime target",
      content: JSON.stringify({
        systemSpec: {
          components: [],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      behaviorKind: "deterministic",
    });

    await studioShell.transitionAssetDraftLifecycle({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensured.session.id,
      draftId: created.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const started = await runtimeApi.startExecution({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
      context: { trigger: "manual", actorId: "system-runtime-test" },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.executionId).toBeDefined();

    const status = await runtimeApi.getExecutionStatus(started.data!.executionId);
    expect(status.ok).toBeTrue();
    expect(status.data?.executionId).toBe(started.data?.executionId);
    expect(status.data?.progress.totalNodeCount).toBeGreaterThan(0);
    expect((status.data?.nodeStatuses.length ?? 0) > 0).toBeTrue();
    expect(status.data?.recovery.decisionCount).toBeGreaterThanOrEqual(0);

    const trace = await runtimeApi.getExecutionTrace({ executionId: started.data!.executionId, eventLimit: 5, logLimit: 3 });
    expect(trace.ok).toBeTrue();
    expect((trace.data?.trace.events.length ?? 0) <= 5).toBeTrue();
    expect((trace.data?.trace.logs.length ?? 0) <= 3).toBeTrue();

    const result = await runtimeApi.getExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    expect(result.data?.executionId).toBe(started.data?.executionId);
    expect(result.data?.output).toBeDefined();
    expect(result.data?.outputSummary.hasOutput).toBeTrue();
    expect((result.data?.nodeResults.length ?? 0) > 0).toBeTrue();
    expect(result.data?.diagnostics.length).toBeGreaterThanOrEqual(0);
  });

  it("returns coherent not-found and invalid-request errors", async () => {
    const repository = new InMemoryStudioShellRepository();
    const runtimeApi = new SystemRuntimeBackendApi(repository);

    const missing = await runtimeApi.getExecutionStatus("execution-missing");
    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("not-found");

    const invalid = await runtimeApi.startExecution({});
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
  });

  it("enforces version-aware execution and projects executed version maps", async () => {
    const repository = new InMemoryStudioShellRepository();
    const idQueue = ["session-versioned", "draft-versioned"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");
    const systemService = new SystemStudioApplicationService(studioShell, repository);
    const runtimeApi = new SystemRuntimeBackendApi(repository);

    const ensured = await systemService.ensureStudioInitialized();
    const created = await systemService.createSystemDraft({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensured.session.id,
      draftId: "draft-versioned",
      title: "Version-aware runtime target",
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "atomic",
              alias: "model",
              assetId: "asset:model",
              taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
            },
          ],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      behaviorKind: "deterministic",
    });

    await studioShell.transitionAssetDraftLifecycle({
      studioId: SystemStudioIdentity.defaultStudioId,
      sessionId: ensured.session.id,
      draftId: created.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const rejected = await runtimeApi.startExecution({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
    });
    expect(rejected.ok).toBeFalse();
    expect(rejected.error?.code).toBe("invalid-request");
    expect(rejected.error?.message).toContain("pinned component versions");

    const started = await runtimeApi.startExecution({
      studioId: SystemStudioIdentity.defaultStudioId,
      draftId: created.draft.id,
      componentVersionPins: {
        model: "asset:model:v42",
      },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.executedVersionMap.nodeVersionIds).toBeDefined();
    const pinnedNodeVersion = Object.values(started.data?.executedVersionMap.nodeVersionIds ?? {}).find((entry) => entry === "asset:model:v42");
    expect(pinnedNodeVersion).toBe("asset:model:v42");

    const result = await runtimeApi.getExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    expect(Object.values(result.data?.executedVersionMap.nodeVersionIds ?? {})).toContain("asset:model:v42");

    const recent = await runtimeApi.listRecentExecutionsForSystem({
      assetId: created.draft.assetId,
      limit: 5,
    });
    expect(recent.ok).toBeTrue();
    expect(recent.data?.length).toBeGreaterThan(0);
    expect(recent.data?.[0]?.executionId).toBe(started.data?.executionId);
  });
});
