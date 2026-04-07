import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { RuntimeAccessControlService } from "../../../../application/system-runtime/RuntimeAccessControlService";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
import { RuntimeClient, ExternalInterfaceRuntimeSdkTransport } from "../sdk";
import { ToolInvocationBridge, ExternalToolInvocationActions } from "../ToolInvocationBridge";

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

async function seedSystems(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:interop-a",
    versionId: "system:interop-a:v1",
    metadata: {
      metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
      content: JSON.stringify({
        systemSpec: {
          components: [],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      dependencies: [],
    },
  }));
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:interop-b",
    versionId: "system:interop-b:v2",
    metadata: {
      metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
      content: JSON.stringify({
        systemSpec: {
          components: [],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      dependencies: [],
    },
  }));
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:interop-parent",
    versionId: "system:interop-parent:v5",
    metadata: {
      metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "system",
              alias: "child",
              assetId: "system:interop-b",
              versionId: "system:interop-b:v2",
              taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            },
          ],
          nestedSystems: [{ alias: "child", assetId: "system:interop-b", versionId: "system:interop-b:v2" }],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      dependencies: [],
    },
  }));
}

describe("External interop tests (cross-system)", () => {
  it("keeps multi-system executions isolated with coherent status/result/session identities", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedSystems(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-a": { callerKind: "user", callerId: "user-a", metadata: { tenantId: "tenant-a" } },
        "token-b": { callerKind: "user", callerId: "user-b", metadata: { tenantId: "tenant-b" } },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const first = await external.startExecution({
      systemId: "system:interop-a",
      versionId: "system:interop-a:v1",
      inputPayload: { request: "one" },
      authentication: { bearerToken: "token-a" },
      tenantId: "tenant-a",
      async: true,
    });
    const second = await external.startExecution({
      systemId: "system:interop-b",
      versionId: "system:interop-b:v2",
      inputPayload: { request: "two" },
      authentication: { bearerToken: "token-a" },
      tenantId: "tenant-a",
      async: true,
    });

    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    expect(first.data?.executionId).not.toBe(second.data?.executionId);
    expect(first.data?.sessionId).not.toBe(second.data?.sessionId);

    for (const executionId of [first.data!.executionId, second.data!.executionId]) {
      let poll = await external.pollExecution({ executionId, authentication: { bearerToken: "token-a" }, tenantId: "tenant-a" });
      for (let attempt = 0; attempt < 30 && poll.ok && poll.data?.acceptedState === "running"; attempt += 1) {
        await Bun.sleep(5);
        poll = await external.pollExecution({ executionId, authentication: { bearerToken: "token-a" }, tenantId: "tenant-a" });
      }
      expect(poll.ok).toBeTrue();

      const result = await external.getExecutionResult({ executionId, authentication: { bearerToken: "token-a" }, tenantId: "tenant-a" });
      expect(result.ok).toBeTrue();
      expect(result.data?.rootAssetId.startsWith("system:interop-")).toBeTrue();
    }

    const deniedByTenant = await external.getExecutionStatus({
      executionId: first.data!.executionId,
      authentication: { bearerToken: "token-b" },
      tenantId: "tenant-b",
    });
    expect(deniedByTenant.ok).toBeFalse();
    expect(deniedByTenant.error?.code).toBe("forbidden");
  });

  it("keeps nested parent/child execution lineage coherent and consistent across API, SDK, and tool bridge", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedSystems(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-a": { callerKind: "user", callerId: "user-a", metadata: { tenantId: "tenant-a" } },
      }),
    );

    const external = new ExternalSystemRuntimeInterface(backend);
    const client = new RuntimeClient({
      transport: new ExternalInterfaceRuntimeSdkTransport(external),
      authentication: { bearerToken: "token-a" },
      accessContext: { callerKind: "user", callerId: "user-a", tenantId: "tenant-a" },
    });
    const bridge = new ToolInvocationBridge(external);

    const apiStarted = await external.startExecution({
      systemId: "system:interop-parent",
      versionId: "system:interop-parent:v5",
      inputPayload: { request: "parent-from-api" },
      authentication: { bearerToken: "token-a" },
      tenantId: "tenant-a",
    });
    expect(apiStarted.ok).toBeTrue();
    expect(apiStarted.data?.nestedExecutionLineage.length).toBeGreaterThan(0);

    const sdkStarted = await client.startExecution({
      systemId: "system:interop-parent",
      versionId: "system:interop-parent:v5",
      inputPayload: { request: "parent-from-sdk" },
      tenantId: "tenant-a",
    });
    expect(sdkStarted.ok).toBeTrue();

    const bridgeStarted = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:interop-parent",
      versionId: "system:interop-parent:v5",
      inputPayload: { request: "parent-from-tool" },
      tenantId: "tenant-a",
      invocationContext: { authentication: { bearerToken: "token-a" } },
    });
    expect(bridgeStarted.ok).toBeTrue();

    const statusFromApi = await external.getExecutionStatus({
      executionId: apiStarted.data!.executionId,
      authentication: { bearerToken: "token-a" },
      tenantId: "tenant-a",
    });
    const statusFromSdk = await client.getExecutionStatus({
      executionId: sdkStarted.data!.executionId,
      tenantId: "tenant-a",
    });
    const statusFromTool = await bridge.invoke({
      action: ExternalToolInvocationActions.getExecutionStatus,
      executionId: bridgeStarted.data!.execution.executionId,
      tenantId: "tenant-a",
      invocationContext: { authentication: { bearerToken: "token-a" } },
    });

    expect(statusFromApi.ok).toBeTrue();
    expect(statusFromSdk.ok).toBeTrue();
    expect(statusFromTool.ok).toBeTrue();
    expect(statusFromApi.data?.nestedExecutionLineage.length).toBeGreaterThan(0);
    expect(statusFromSdk.data?.nestedExecutionLineage.length).toBeGreaterThan(0);
    expect((statusFromTool.data?.payload.executedVersionMap as { rootVersionId?: string } | undefined)?.rootVersionId).toBe("system:interop-parent:v5");

    const apiResult = await external.getExecutionResult({
      executionId: apiStarted.data!.executionId,
      authentication: { bearerToken: "token-a" },
      tenantId: "tenant-a",
    });
    const sdkResult = await client.getExecutionResult({ executionId: sdkStarted.data!.executionId, tenantId: "tenant-a" });
    const toolResult = await bridge.invoke({
      action: ExternalToolInvocationActions.getExecutionResult,
      executionId: bridgeStarted.data!.execution.executionId,
      tenantId: "tenant-a",
      invocationContext: { authentication: { bearerToken: "token-a" } },
    });

    expect(apiResult.ok).toBeTrue();
    expect(sdkResult.ok).toBeTrue();
    expect(toolResult.ok).toBeTrue();
    expect(apiResult.data?.nestedExecutionLineage[0]?.parentExecutionId).toBe(apiStarted.data?.executionId);
    expect(sdkResult.data?.nestedExecutionLineage[0]?.parentExecutionId).toBe(sdkStarted.data?.executionId);
    expect(toolResult.data?.execution.versionId).toBe("system:interop-parent:v5");
  });
});
