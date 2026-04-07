import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "@domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { RuntimeAccessControlService } from "@application/system-runtime/RuntimeAccessControlService";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
import {
  ExternalInterfaceRuntimeSdkTransport,
  RuntimeClient,
  type RuntimeSdkTransport,
} from "../sdk";

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
    assetId: "system:sdk",
    versionId: "system:sdk:v1",
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

describe("RuntimeClient SDK contract", () => {
  it("maps SDK start/status/result/trace contracts to the existing external runtime API", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"], metadata: { tenantId: "tenant-a" } },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);
    const client = new RuntimeClient({
      transport: new ExternalInterfaceRuntimeSdkTransport(external),
      authentication: { bearerToken: "token-user-1" },
      accessContext: { callerKind: "user", callerId: "user-1", tenantId: "tenant-a", roles: ["external-runtime"] },
    });

    const started = await client.startExecution({
      systemId: "system:sdk",
      versionId: "system:sdk:v1",
      async: true,
      inputPayload: { request: "hello" },
      tenantId: "tenant-a",
      callback: {
        targetUrl: "https://example.test/runtime-callback",
        eventKinds: ["execution-accepted", "execution-completed"],
      },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.executionId).toBeDefined();
    expect(started.data?.sessionId).toBeDefined();
    expect(started.data?.versionId).toBe("system:sdk:v1");
    expect(started.data?.acceptedState).toBe("accepted");

    let status = await client.getExecutionStatus({ sessionId: started.data!.sessionId, tenantId: "tenant-a" });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (status.ok && status.data?.executionId) {
        break;
      }
      if (status.error?.code !== "not-found") {
        break;
      }
      await Bun.sleep(5);
      status = await client.getExecutionStatus({ sessionId: started.data!.sessionId, tenantId: "tenant-a" });
    }

    expect(status.ok, status.error?.message).toBeTrue();
    expect(status.data?.executionId).toBe(started.data?.executionId);
    expect(status.data?.executedVersionMap.rootVersionId).toBe("system:sdk:v1");

    const result = await client.getExecutionResult({
      executionId: started.data!.executionId,
      nodeResultLimit: 1,
      diagnosticsLimit: 1,
      tenantId: "tenant-a",
    });
    expect(result.ok).toBeTrue();
    expect((result.data?.diagnostics.length ?? 0) <= 1).toBeTrue();
    expect(result.data?.bounded).toEqual({ nodeResultsTruncated: expect.any(Boolean), diagnosticsTruncated: expect.any(Boolean) });

    const trace = await client.getExecutionTrace({
      executionId: started.data!.executionId,
      eventLimit: 2,
      logLimit: 2,
      tenantId: "tenant-a",
    });
    expect(trace.ok).toBeTrue();
    expect((trace.data?.trace.events.length ?? 0) <= 2).toBeTrue();
    expect((trace.data?.trace.logs.length ?? 0) <= 2).toBeTrue();
  });

  it("returns structured SDK errors without leaking internal exceptions", async () => {
    const repository = new InMemoryStudioShellRepository();
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const client = new RuntimeClient({
      transport: new ExternalInterfaceRuntimeSdkTransport(new ExternalSystemRuntimeInterface(backend)),
      authentication: { bearerToken: "token-user-1" },
      accessContext: { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
    });

    const invalid = await client.startExecution({
      systemId: "system:sdk",
      versionId: "invalid",
    });

    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
    expect(invalid.error?.message).toContain("version suffix");
    expect(Object.keys(invalid.error ?? {})).toEqual(expect.arrayContaining(["code", "message"]));
  });

  it("allows per-call auth/context overrides while keeping the client transport thin", async () => {
    const calls: Array<{ request: unknown; context: unknown }> = [];
    const transport: RuntimeSdkTransport = {
      async startExecution(request, context) {
        calls.push({ request, context });
        return Object.freeze({
          ok: true,
          data: {
            executionId: "execution-1",
            sessionId: "session-1",
            status: "pending",
            acceptedState: "accepted",
            systemId: "system:sdk",
            versionId: "system:sdk:v1",
            executedVersionMap: { nodeVersionIds: {} },
            nestedExecutionLineage: [],
          },
        });
      },
      async getExecutionStatus() { throw new Error("not-used"); },
      async getExecutionResult() { throw new Error("not-used"); },
      async getExecutionTrace() { throw new Error("not-used"); },
    };

    const client = new RuntimeClient({
      transport,
      authentication: { bearerToken: "default-token" },
      accessContext: { callerKind: "user", callerId: "default-caller" },
    });

    const response = await client.startExecution(
      { systemId: "system:sdk", versionId: "system:sdk:v1" },
      {
        authentication: { bearerToken: "override-token" },
        accessContext: { callerKind: "service", callerId: "svc-1" },
      },
    );

    expect(response.ok).toBeTrue();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.context).toEqual({
      authentication: { bearerToken: "override-token" },
      accessContext: { callerKind: "service", callerId: "svc-1" },
    });
  });
});

