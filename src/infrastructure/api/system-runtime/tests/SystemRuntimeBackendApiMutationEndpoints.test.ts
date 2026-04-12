import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "@domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { createSystemStudioTaxonomy } from "@domain/system-studio/SystemAssetDomain";
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

function createRuntimeApi() {
  const repository = new InMemoryStudioShellRepository();
  repository.saveAssetVersion(new AssetVersion({
    assetId: "system:queue",
    versionId: "system:queue:v1",
    metadata: {
      metadata: {
        taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
      },
      content: JSON.stringify({
        systemSpec: {
          components: [],
          inputs: [{ inputId: "request", valueType: "string", required: false }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      dependencies: [],
    },
  }));
  return new SystemRuntimeBackendApi(repository);
}

describe("SystemRuntimeBackendApi runtime mutation support", () => {
  it("supports idempotent cancellation results for the same run mutation key", async () => {
    const runtimeApi = createRuntimeApi();
    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:queue:v1",
      systemId: "system:queue",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });
    expect(started.ok).toBeTrue();
    const executionId = started.data!.executionId;

    const firstCancel = await runtimeApi.cancelExecution({
      executionId,
      idempotencyKey: "cancel-key-1",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });
    expect(firstCancel.ok).toBeTrue();

    const repeatedCancel = await runtimeApi.cancelExecution({
      executionId,
      idempotencyKey: "cancel-key-1",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });
    expect(repeatedCancel.ok).toBeTrue();
    expect(repeatedCancel.data?.mutation.mutationId).toBe(firstCancel.data?.mutation.mutationId);
  });

  it("supports dequeue queue-item mutation contracts", async () => {
    const runtimeApi = createRuntimeApi();
    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:queue:v1",
      systemId: "system:queue",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });
    expect(started.ok).toBeTrue();
    const executionId = started.data!.executionId;

    const dequeue = await runtimeApi.dequeueQueueItem({
      queueItemId: `runtime-queue:${executionId}`,
      idempotencyKey: "dequeue-key-1",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });

    expect(dequeue.ok).toBeTrue();
    expect(dequeue.data?.queueItemId).toBe(`runtime-queue:${executionId}`);
    expect(dequeue.data?.executionId).toBe(executionId);
    expect(typeof dequeue.data?.mutation.changed).toBe("boolean");
  });

  it("validates dequeue queue-item identifiers", async () => {
    const runtimeApi = createRuntimeApi();
    const response = await runtimeApi.dequeueQueueItem({
      queueItemId: "   ",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });
    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-request");
  });
});

