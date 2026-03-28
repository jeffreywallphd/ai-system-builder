import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { RuntimeAccessControlService, type ExecutionAccessDecision, type ExecutionAccessPolicy, type ExecutionAccessRequest } from "../../../../application/system-runtime/RuntimeAccessControlService";
import { ExecutionQuotaEvaluator } from "../../../../application/system-runtime/ExecutionQuotaEvaluator";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
import type { ExecutionCallbackDispatcher, ExecutionCallbackPayload } from "../ExecutionCallbackDispatcher";
import { ExecutionAuditEventKinds } from "../../../../domain/system-runtime/ExecutionAuditTrailDomain";

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

class RequireCallerPolicy implements ExecutionAccessPolicy {
  public readonly policyId = "require-caller";

  public evaluate(request: ExecutionAccessRequest): ExecutionAccessDecision {
    if (request.context?.callerId !== "external-user") {
      return Object.freeze({
        allowed: false,
        reasonCode: "caller-mismatch",
        message: "Caller is not allowed to run this system.",
        policyId: this.policyId,
      });
    }
    return Object.freeze({ allowed: true, policyId: this.policyId });
  }
}

class RecordingCallbackDispatcher implements ExecutionCallbackDispatcher {
  public readonly deliveries: ExecutionCallbackPayload[] = [];

  public async dispatch(
    registration: Parameters<ExecutionCallbackDispatcher["dispatch"]>[0],
    payload: ExecutionCallbackPayload,
  ): Promise<Awaited<ReturnType<ExecutionCallbackDispatcher["dispatch"]>>> {
    this.deliveries.push(payload);
    return Object.freeze({
      callbackId: registration.callbackId,
      eventKind: payload.eventKind,
      executionId: payload.executionId,
      deliveredAt: new Date().toISOString(),
      attemptCount: 1,
      succeeded: true,
      message: "ok",
      statusCode: 200,
    });
  }
}

async function seedVersion(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:e2e",
    versionId: "system:e2e:v1",
    metadata: {
      metadata: {
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      },
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
}

describe("External invocation lifecycle (E2E)", () => {
  it("runs auth→access→quota→validation→async execution→status/result/audit/session end-to-end", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const callbacks = new RecordingCallbackDispatcher();
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireCallerPolicy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-allowed": { callerKind: "user", callerId: "external-user", metadata: { tenantId: "tenant-a" } },
        "token-other": { callerKind: "user", callerId: "other-user", metadata: { tenantId: "tenant-a" } },
      }),
      new ExecutionQuotaEvaluator({ maxConcurrentExecutionsPerCaller: 1, maxExecutionsPerWindow: 2, windowMs: 60_000 }),
      undefined,
      callbacks,
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const unauthorized = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      authentication: { bearerToken: "" },
      tenantId: "tenant-a",
    });
    expect(unauthorized.ok).toBeFalse();
    expect(unauthorized.error?.code).toBe("unauthorized");

    const forbidden = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      authentication: { bearerToken: "token-other" },
      tenantId: "tenant-a",
    });
    expect(forbidden.ok).toBeFalse();
    expect(forbidden.error?.code).toBe("forbidden");

    const invalid = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
      inputPayload: {},
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");

    const started = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      async: true,
      inputPayload: { request: "hello e2e" },
      callback: {
        targetUrl: "https://callbacks.example.test/e2e",
        includeResultSummary: true,
      },
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
    });
    expect(started.ok, started.error?.message).toBeTrue();
    expect(started.data?.acceptedState).toBe("accepted");
    expect(started.data?.sessionId).toBeDefined();

    let poll = await external.pollExecution({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
    });
    for (let attempt = 0; attempt < 40 && poll.ok && poll.data?.acceptedState === "running"; attempt += 1) {
      await Bun.sleep(5);
      poll = await external.pollExecution({
        sessionId: started.data!.sessionId,
        authentication: { bearerToken: "token-allowed" },
        tenantId: "tenant-a",
      });
    }

    expect(poll.ok, poll.error?.message).toBeTrue();
    expect(["running", "completed", "failed"]).toContain(poll.data?.acceptedState);

    const status = await external.getExecutionStatus({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
    });
    expect(status.ok, status.error?.message).toBeTrue();
    expect(status.data?.rootVersionId).toBe("system:e2e:v1");

    const result = await external.getExecutionResult({
      executionId: started.data!.executionId,
      nodeResultLimit: 4,
      diagnosticsLimit: 4,
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
    });
    expect(result.ok, result.error?.message).toBeTrue();
    expect(result.data?.serialized.identity.executionId).toBe(started.data?.executionId);

    const session = await backend.getExecutionSession(started.data!.sessionId!, {
      requireAuthentication: true,
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
    });
    expect(session.ok).toBeTrue();
    expect(session.data?.lastExecutionId).toBe(started.data?.executionId);
    expect((session.data?.callbackDeliveries.length ?? 0) > 0).toBeTrue();

    const audit = await backend.getExecutionAuditTrail({
      executionId: started.data!.executionId,
      requestContext: {
        requireAuthentication: true,
        authentication: { bearerToken: "token-allowed" },
        tenantId: "tenant-a",
      },
    });
    expect(audit.ok, audit.error?.message).toBeTrue();
    expect(audit.data?.some((entry) => entry.eventKind === ExecutionAuditEventKinds.requested)).toBeTrue();
    expect(audit.data?.some((entry) => entry.eventKind === ExecutionAuditEventKinds.accepted)).toBeTrue();
    expect(audit.data?.some((entry) => entry.eventKind === ExecutionAuditEventKinds.completed)).toBeTrue();

    expect(callbacks.deliveries.some((entry) => entry.eventKind === "execution-accepted")).toBeTrue();
    expect(callbacks.deliveries.some((entry) => entry.eventKind === "execution-completed")).toBeTrue();

    const recent = await backend.listRecentExecutionsForSystem({ assetId: "system:e2e", versionId: "system:e2e:v1", limit: 10 });
    expect(recent.ok).toBeTrue();
    expect(recent.data?.map((entry) => entry.executionId)).toContain(started.data?.executionId);
  });

  it("fails over-quota external starts cleanly and does not create additional execution records", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireCallerPolicy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-allowed": { callerKind: "user", callerId: "external-user", metadata: { tenantId: "tenant-a" } },
      }),
      new ExecutionQuotaEvaluator({ maxConcurrentExecutionsPerCaller: 1, maxExecutionsPerWindow: 1, windowMs: 60_000 }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const accepted = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
      inputPayload: { request: "first" },
    });
    expect(accepted.ok).toBeTrue();

    const blocked = await external.startExecution({
      systemId: "system:e2e",
      versionId: "system:e2e:v1",
      authentication: { bearerToken: "token-allowed" },
      tenantId: "tenant-a",
      inputPayload: { request: "second" },
    });
    expect(blocked.ok).toBeFalse();
    expect(blocked.error?.code).toBe("quota-exceeded");

    const recent = await backend.listRecentExecutionsForSystem({ assetId: "system:e2e", versionId: "system:e2e:v1", limit: 10 });
    expect(recent.ok).toBeTrue();
    expect(recent.data?.length).toBe(1);
    expect(recent.data?.[0]?.executionId).toBe(accepted.data?.executionId);
  });
});
