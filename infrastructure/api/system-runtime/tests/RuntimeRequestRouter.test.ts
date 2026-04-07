import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../src/domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../src/domain/assets/AssetVersion";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { RuntimeRequestRouter, RuntimeRequestSources } from "../RuntimeRequestRouter";
import { ExternalToolInvocationActions } from "../ToolInvocationBridge";

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

async function seedVersion(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:router",
    versionId: "system:router:v2",
    metadata: {
      metadata: {
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
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
}

describe("RuntimeRequestRouter", () => {
  it("routes internal studio requests through trusted runtime backend flow", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const router = new RuntimeRequestRouter(new SystemRuntimeBackendApi(repository));

    const start = await router.dispatch({
      source: RuntimeRequestSources.studioShellInternal,
      operation: "start-execution",
      request: {
        versionId: "system:router:v2",
        inputPayload: { request: "from-ui" },
      },
    });

    expect(start.response.ok).toBeTrue();
    expect(start.response.data?.executionId).toBeDefined();

    const status = await router.dispatch({
      source: RuntimeRequestSources.studioShellInternal,
      operation: "get-execution-status",
      request: {
        executionId: start.response.data!.executionId,
      },
    });
    expect(status.response.ok).toBeTrue();
    expect(status.response.data?.rootVersionId).toBe("system:router:v2");
  });

  it("routes authenticated external API requests without bypassing context semantics", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const router = new RuntimeRequestRouter(backend);

    const started = await router.dispatch({
      source: RuntimeRequestSources.externalApi,
      operation: "start-execution",
      request: {
        systemId: "system:router",
        versionId: "system:router:v2",
        async: true,
        authentication: { bearerToken: "token-user-1" },
      },
    });
    expect(started.response.ok).toBeTrue();
    expect(started.response.data?.acceptedState).toBe("accepted");

    let status = await router.dispatch({
      source: RuntimeRequestSources.externalApi,
      operation: "get-execution-status",
      request: {
        executionId: started.response.data!.executionId,
        authentication: { bearerToken: "token-user-1" },
      },
    });
    for (let attempt = 0; attempt < 30 && !status.response.ok; attempt += 1) {
      await Bun.sleep(5);
      status = await router.dispatch({
        source: RuntimeRequestSources.externalApi,
        operation: "get-execution-status",
        request: {
          executionId: started.response.data!.executionId,
          authentication: { bearerToken: "token-user-1" },
        },
      });
    }
    expect(status.response.ok).toBeTrue();
    expect(status.response.data?.executedVersionMap.rootVersionId).toBe("system:router:v2");
  });

  it("routes external tool invocation requests via tool bridge with bounded responses", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const router = new RuntimeRequestRouter(backend);

    const started = await router.dispatch({
      source: RuntimeRequestSources.externalTool,
      operation: "invoke-tool",
      request: {
        action: ExternalToolInvocationActions.startExecution,
        systemId: "system:router",
        versionId: "system:router:v2",
        async: true,
        invocationContext: {
          protocol: "mcp",
          authentication: { bearerToken: "token-user-1" },
        },
      },
    });

    expect(started.response.ok).toBeTrue();
    expect(started.response.data?.action).toBe("start-execution");

    let result = await router.dispatch({
      source: RuntimeRequestSources.externalTool,
      operation: "invoke-tool",
      request: {
        action: ExternalToolInvocationActions.getExecutionResult,
        executionId: started.response.data!.execution.executionId,
        nodeResultLimit: 1,
        diagnosticsLimit: 1,
        invocationContext: {
          authentication: { bearerToken: "token-user-1" },
        },
      },
    });

    for (let attempt = 0; attempt < 30 && !result.response.ok; attempt += 1) {
      await Bun.sleep(5);
      result = await router.dispatch({
        source: RuntimeRequestSources.externalTool,
        operation: "invoke-tool",
        request: {
          action: ExternalToolInvocationActions.getExecutionResult,
          executionId: started.response.data!.execution.executionId,
          nodeResultLimit: 1,
          diagnosticsLimit: 1,
          invocationContext: {
            authentication: { bearerToken: "token-user-1" },
          },
        },
      });
    }

    expect(result.response.ok).toBeTrue();
    expect(typeof result.response.data?.bounded.nodeResultsTruncated).toBe("boolean");
    expect(typeof result.response.data?.bounded.diagnosticsTruncated).toBe("boolean");
  });
});
