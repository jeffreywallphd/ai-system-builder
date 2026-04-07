import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../src/domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../src/domain/assets/AssetVersion";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
import {
  RuntimeAccessControlService,
  type ExecutionAccessDecision,
  type ExecutionAccessPolicy,
  type ExecutionAccessRequest,
} from "../../../../application/system-runtime/RuntimeAccessControlService";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { ExecutionQuotaEvaluator } from "../../../../application/system-runtime/ExecutionQuotaEvaluator";
import { RuntimeRateLimitEvaluator } from "../../../../application/system-runtime/RuntimeRateLimitEvaluator";

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

class DenyAllPolicy implements ExecutionAccessPolicy {
  public readonly policyId = "deny-all";

  public evaluate(_request: ExecutionAccessRequest): ExecutionAccessDecision {
    return Object.freeze({
      allowed: false,
      reasonCode: "policy-denied",
      message: "Caller cannot execute this system version.",
      policyId: this.policyId,
    });
  }
}

class RequireUser1Policy implements ExecutionAccessPolicy {
  public readonly policyId = "require-user-1";
  public evaluate(request: ExecutionAccessRequest): ExecutionAccessDecision {
    if (request.context?.callerId !== "user-1") {
      return Object.freeze({
        allowed: false,
        reasonCode: "caller-mismatch",
        message: "Caller is not allowed to access this execution.",
        policyId: this.policyId,
      });
    }
    return Object.freeze({ allowed: true, policyId: this.policyId });
  }
}

async function seedVersion(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:external",
    versionId: "system:external:v1",
    metadata: {
      metadata: {
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      },
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "atomic",
              alias: "model",
              assetId: "asset:model",
              versionId: "asset:model:v1",
              taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
            },
          ],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
          parameters: [{ parameterId: "temperature", valueType: "number", required: false }],
        },
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    },
  }));
}

async function seedNestedVersions(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:external-child",
    versionId: "system:external-child:v1",
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
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:external-parent",
    versionId: "system:external-parent:v1",
    metadata: {
      metadata: {
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      },
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "system",
              alias: "child",
              assetId: "system:external-child",
              versionId: "system:external-child:v1",
              taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            },
          ],
          nestedSystems: [{ alias: "child", assetId: "system:external-child", versionId: "system:external-child:v1" }],
          inputs: [{ inputId: "request", valueType: "string", required: false }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      dependencies: [],
    },
  }));
}

describe("ExternalSystemRuntimeInterface", () => {
  it("starts and reads execution through the existing runtime backend path", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const started = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      async: true,
      inputPayload: { request: "hello" },
      authentication: { bearerToken: "token-user-1" },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.systemId).toBe("system:external");
    expect(started.data?.versionId).toBe("system:external:v1");
    expect(started.data?.sessionId).toBeDefined();
    expect(started.data?.acceptedState).toBe("accepted");
    expect(started.data?.executedVersionMap.rootVersionId).toBe("system:external:v1");

    const polled = await external.pollExecution({
      sessionId: started.data?.sessionId,
      authentication: { bearerToken: "token-user-1" },
    });
    expect(polled.ok).toBeTrue();
    expect(polled.data?.executionId).toBe(started.data?.executionId);
    expect(["running", "completed", "failed"]).toContain(polled.data?.acceptedState);

    let polledStatus = await external.pollExecution({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-1" },
    });
    for (let attempt = 0; attempt < 30 && polledStatus.ok && polledStatus.data?.acceptedState === "running"; attempt += 1) {
      await Bun.sleep(5);
      polledStatus = await external.pollExecution({
        executionId: started.data!.executionId,
        authentication: { bearerToken: "token-user-1" },
      });
    }

    const status = await external.getExecutionStatus({
      executionId: polledStatus.data?.executionId ?? started.data!.executionId,
      authentication: { bearerToken: "token-user-1" },
    });
    expect(status.ok).toBeTrue();
    expect(status.data?.rootAssetId).toBe("system:external");

    const trace = await external.getExecutionTrace({
      executionId: started.data!.executionId,
      eventLimit: 3,
      logLimit: 2,
      authentication: { bearerToken: "token-user-1" },
    });
    expect(trace.ok).toBeTrue();
    expect((trace.data?.trace.events.length ?? 0) <= 3).toBeTrue();
    expect((trace.data?.trace.logs.length ?? 0) <= 2).toBeTrue();

    const result = await external.getExecutionResult({
      executionId: started.data!.executionId,
      nodeResultLimit: 1,
      diagnosticsLimit: 1,
      authentication: { bearerToken: "token-user-1" },
    });
    expect(result.ok).toBeTrue();
    expect((result.data?.nodeResults.length ?? 0) <= 1).toBeTrue();
    expect((result.data?.diagnostics.length ?? 0) <= 1).toBeTrue();
    expect(result.data?.bounded).toBeDefined();
    expect(result.data?.serialized.identity.executionId).toBe(started.data?.executionId);
    expect(result.data?.serialized.summary.nodeResultCount).toBe(result.data?.nodeResults.length);
  });

  it("keeps nested system invocation lineage visible for external callers", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedNestedVersions(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"], metadata: { tenantId: "tenant-a" } },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);
    const started = await external.startExecution({
      systemId: "system:external-parent",
      versionId: "system:external-parent:v1",
      authentication: { bearerToken: "token-user-1" },
      tenantId: "tenant-a",
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.nestedExecutionLineage.length).toBeGreaterThan(0);

    const status = await external.getExecutionStatus({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-1" },
      tenantId: "tenant-a",
    });
    expect(status.ok).toBeTrue();
    expect(status.data?.nestedExecutionLineage.length).toBeGreaterThan(0);
    expect(status.data?.nestedExecutionLineage[0]?.parentExecutionId).toBe(started.data?.executionId);

    const result = await external.getExecutionResult({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-1" },
      tenantId: "tenant-a",
    });
    expect(result.ok).toBeTrue();
    expect(result.data?.nestedExecutionLineage.length).toBeGreaterThan(0);
    expect(result.data?.nestedExecutionLineage[0]?.rootVersionId).toBe("system:external-child:v1");
  });

  it("rejects invalid external identity inputs consistently", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const external = new ExternalSystemRuntimeInterface(new SystemRuntimeBackendApi(repository));

    const invalid = await external.startExecution({
      systemId: "system:other",
      versionId: "system:external:v1",
    });

    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
    expect(invalid.error?.message).toContain("must match");
  });

  it("rejects missing or invalid authentication for external runtime API calls", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const missing = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
    });
    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("unauthorized");

    const invalid = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-unknown" },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("unauthorized");
  });

  it("passes authenticated context through access control for start/status/result/trace", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireUser1Policy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["reader"] },
        "token-user-2": { callerKind: "user", callerId: "user-2", roles: ["reader"] },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const started = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
    });
    expect(started.ok).toBeTrue();

    const deniedStatus = await external.getExecutionStatus({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-2" },
    });
    expect(deniedStatus.ok).toBeFalse();
    expect(deniedStatus.error?.code).toBe("forbidden");

    const deniedTrace = await external.getExecutionTrace({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-2" },
    });
    expect(deniedTrace.ok).toBeFalse();
    expect(deniedTrace.error?.code).toBe("forbidden");

    const deniedResult = await external.getExecutionResult({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "token-user-2" },
    });
    expect(deniedResult.ok).toBeFalse();
    expect(deniedResult.error?.code).toBe("forbidden");
  });

  it("enforces access-control denials before runtime orchestration across backend and external entrypoints", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const access = new RuntimeAccessControlService(new DenyAllPolicy());
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      access,
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const deniedBackend = await backend.startExecution({
      versionId: "system:external:v1",
      systemId: "system:external",
      accessContext: { callerKind: "user", callerId: "user-1" },
    });
    expect(deniedBackend.ok).toBeFalse();
    expect(deniedBackend.error?.code).toBe("forbidden");

    const deniedExternal = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      callerContext: { callerKind: "user", callerId: "user-1" },
      authentication: { bearerToken: "token-user-1" },
    });
    expect(deniedExternal.ok).toBeFalse();
    expect(deniedExternal.error?.code).toBe("forbidden");
    expect(deniedExternal.error?.message).toContain("cannot execute");
  });

  it("enforces quota limits before execution starts", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
      new ExecutionQuotaEvaluator({
        maxConcurrentExecutionsPerCaller: 3,
        maxExecutionsPerWindow: 1,
        windowMs: 60_000,
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const first = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
    });
    expect(first.ok).toBeTrue();

    const blocked = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
    });
    expect(blocked.ok).toBeFalse();
    expect(blocked.error?.code).toBe("quota-exceeded");
  });

  it("rejects missing required inputs before runtime orchestration begins", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const invalid = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      inputPayload: {},
      authentication: { bearerToken: "token-user-1" },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
    expect(invalid.error?.validationErrors?.some((entry) => entry.code === "missing-required-input")).toBeTrue();
  });

  it("rejects invalid runtime parameters/config payload shapes with structured validation errors", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const invalid = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      inputPayload: {
        request: "ok",
        parameters: { temperature: "hot" },
        config: "bad-config",
      },
      authentication: { bearerToken: "token-user-1" },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
    const issueCodes = new Set(invalid.error?.validationErrors?.map((entry) => entry.code) ?? []);
    expect(issueCodes.has("invalid-parameter-type")).toBeTrue();
    expect(issueCodes.has("invalid-config-payload")).toBeTrue();
  });

  it("applies version-aware runtime input validation using the pinned version contract", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:external",
      versionId: "system:external:v2",
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            inputs: [{ inputId: "prompt", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));

    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const invalidV2 = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v2",
      inputPayload: { request: "legacy-field" },
      authentication: { bearerToken: "token-user-1" },
    });
    expect(invalidV2.ok).toBeFalse();
    expect(invalidV2.error?.validationErrors?.some((entry) => entry.path === "inputPayload.prompt")).toBeTrue();

    const validV2 = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v2",
      inputPayload: { prompt: "new-field" },
      authentication: { bearerToken: "token-user-1" },
    });
    expect(validV2.ok).toBeTrue();
  });

  it("preserves trusted internal runtime path without external authentication", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireUser1Policy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
      }),
    );

    const trusted = await backend.startExecution({
      versionId: "system:external:v1",
      systemId: "system:external",
      requestContext: { trustedInternal: true },
      accessContext: { callerKind: "user", callerId: "user-1" },
    });
    expect(trusted.ok).toBeTrue();
  });

  it("exposes bounded execution environment configuration and selected environment details", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const started = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      inputPayload: { request: "hello" },
      authentication: { bearerToken: "token-user-1" },
      requestedEnvironment: {
        option: "local",
        configuration: {
          requireNestedSystems: true,
        },
      },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.executionEnvironment?.environmentId).toBe("runtime:local-default");
    expect(started.data?.executionEnvironment?.option).toBe("local");
    expect(started.data?.executionEnvironment?.capabilities.supportsNestedSystems).toBeTrue();

    const invalid = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
      requestedEnvironment: { option: "unsafe-custom" as never },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
  });

  it("enforces tenant-scoped execution isolation across external status/result/trace reads", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "tenant-a-token": { callerKind: "user", callerId: "user-1", metadata: { tenantId: "tenant-a" } },
        "tenant-b-token": { callerKind: "user", callerId: "user-2", metadata: { tenantId: "tenant-b" } },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const started = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      async: true,
      inputPayload: { request: "hello" },
      authentication: { bearerToken: "tenant-a-token" },
      tenantId: "tenant-a",
    });
    expect(started.ok).toBeTrue();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const poll = await external.pollExecution({
        executionId: started.data!.executionId,
        authentication: { bearerToken: "tenant-a-token" },
        tenantId: "tenant-a",
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    const crossTenantStatus = await external.getExecutionStatus({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "tenant-b-token" },
      tenantId: "tenant-b",
    });
    expect(crossTenantStatus.ok).toBeFalse();
    expect(crossTenantStatus.error?.code).toBe("forbidden");

    const crossTenantResult = await external.getExecutionResult({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "tenant-b-token" },
      tenantId: "tenant-b",
    });
    expect(crossTenantResult.ok).toBeFalse();
    expect(crossTenantResult.error?.code).toBe("forbidden");

    const crossTenantTrace = await external.getExecutionTrace({
      executionId: started.data!.executionId,
      authentication: { bearerToken: "tenant-b-token" },
      tenantId: "tenant-b",
    });
    expect(crossTenantTrace.ok).toBeFalse();
    expect(crossTenantTrace.error?.code).toBe("forbidden");
  });

  it("reuses execution identity for idempotent external start retries", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const first = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
      idempotencyKey: "idem-777",
    });
    const replayed = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
      idempotencyKey: "idem-777",
    });

    expect(first.ok).toBeTrue();
    expect(replayed.ok).toBeTrue();
    expect(replayed.data?.executionId).toBe(first.data?.executionId);
  });

  it("returns structured rate-limit errors without retry storms", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
      new ExecutionQuotaEvaluator({ maxConcurrentExecutionsPerCaller: 10, maxExecutionsPerWindow: 100, windowMs: 60_000 }),
      undefined,
      undefined,
      undefined,
      new RuntimeRateLimitEvaluator({
        maxRequestsPerCallerPerWindow: 1,
        maxRequestsPerTenantPerWindow: 10,
        maxRequestsPerSourceOperationPerWindow: 10,
        windowMs: 60_000,
      }),
    );
    const external = new ExternalSystemRuntimeInterface(backend);

    const first = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
    });
    expect(first.ok).toBeTrue();

    const second = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      authentication: { bearerToken: "token-user-1" },
    });
    expect(second.ok).toBeFalse();
    expect(second.error?.code).toBe("rate-limit-exceeded");
  });

});
