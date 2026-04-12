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

function createQueueReadyRuntimeApi() {
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

describe("SystemRuntimeBackendApi runtime read/list support", () => {
  it("lists queue items within requested workspace scope and applies pagination", async () => {
    const runtimeApi = createQueueReadyRuntimeApi();
    const alphaStart = await runtimeApi.startExecutionAsync({
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
    expect(alphaStart.ok).toBeTrue();

    const betaStart = await runtimeApi.startExecutionAsync({
      versionId: "system:queue:v1",
      systemId: "system:queue",
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-beta",
          metadata: { activeWorkspaceId: "workspace-beta" },
        },
      },
    });
    expect(betaStart.ok).toBeTrue();

    const list = await runtimeApi.listQueueItems({
      workspaceId: "workspace-alpha",
      limit: 10,
      offset: 0,
      requestContext: {
        trustedInternal: true,
        accessContext: {
          callerKind: "user",
          callerId: "user-alpha",
          metadata: { activeWorkspaceId: "workspace-alpha" },
        },
      },
    });

    expect(list.ok).toBeTrue();
    expect((list.data?.items.length ?? 0) >= 1).toBeTrue();
    expect(list.data?.items.some((item) => item.executionId === alphaStart.data?.executionId)).toBeTrue();
    expect(list.data?.items.some((item) => item.executionId === betaStart.data?.executionId)).toBeFalse();
  });

  it("rejects queue listing when caller workspace scope does not match request scope", async () => {
    const runtimeApi = createQueueReadyRuntimeApi();
    const list = await runtimeApi.listQueueItems({
      workspaceId: "workspace-alpha",
      requestContext: {
        accessContext: {
          callerKind: "user",
          callerId: "user-beta",
          metadata: { activeWorkspaceId: "workspace-beta" },
        },
      },
    });

    expect(list.ok).toBeFalse();
    expect(list.error?.code).toBe("forbidden");
  });

  it("returns not-found for run reads outside caller workspace scope", async () => {
    const runtimeApi = createQueueReadyRuntimeApi();
    const start = await runtimeApi.startExecutionAsync({
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
    expect(start.ok).toBeTrue();

    const status = await runtimeApi.getExecutionStatus(start.data!.executionId, {
      accessContext: {
        callerKind: "user",
        callerId: "user-beta",
        metadata: { activeWorkspaceId: "workspace-beta" },
      },
    });

    expect(status.ok).toBeFalse();
    expect(status.error?.code).toBe("not-found");
  });
});
