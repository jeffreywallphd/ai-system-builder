import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../../../application/studio-shell/DefaultStudioShellApplicationService";
import { SystemStudioApplicationService } from "../../../../application/system-studio/SystemStudioApplicationService";
import { SystemStudioIdentity, createSystemStudioTaxonomy } from "../../../../domain/system-studio/SystemAssetDomain";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { SqliteStudioShellRepository } from "../../../filesystem/studio-shell/SqliteStudioShellRepository";
import { SqliteSystemRuntimeExecutionStore } from "../../../filesystem/system-runtime/SqliteSystemRuntimeExecutionStore";
import type { ExecutionCallbackDispatcher, ExecutionCallbackPayload } from "../ExecutionCallbackDispatcher";
import { ExecutionUpdateEventKinds } from "../ExecutionUpdateStream";
import { InMemoryExecutionAuditRepository } from "../../../../application/system-runtime/ExecutionAuditRepository";
import { ExecutionAuditEventKinds } from "../../../../domain/system-runtime/ExecutionAuditTrailDomain";

class RecordingCallbackDispatcher implements ExecutionCallbackDispatcher {
  public readonly deliveries: Array<{ payload: ExecutionCallbackPayload; targetUrl: string }> = [];
  public constructor(private readonly shouldFail = false) {}

  public async dispatch(
    registration: Parameters<ExecutionCallbackDispatcher["dispatch"]>[0],
    payload: ExecutionCallbackPayload,
  ): Promise<Awaited<ReturnType<ExecutionCallbackDispatcher["dispatch"]>>> {
    this.deliveries.push({ payload, targetUrl: registration.targetUrl });
    return Object.freeze({
      callbackId: registration.callbackId,
      eventKind: payload.eventKind,
      executionId: payload.executionId,
      deliveredAt: new Date().toISOString(),
      attemptCount: 1,
      succeeded: !this.shouldFail,
      message: this.shouldFail ? "failed" : "ok",
      statusCode: this.shouldFail ? 500 : 200,
    });
  }
}

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

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const poll = await runtimeApi.pollExecution({
        executionId: started.data!.executionId,
        requestContext: {
          trustedInternal: true,
          accessContext: { callerKind: "user", callerId: "tenant-user-a", metadata: { tenantId: "tenant-a" } },
          tenantId: "tenant-a",
        },
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }
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
    expect(result.data?.serialized.identity.executionId).toBe(started.data?.executionId);
    expect(result.data?.serialized.summary.nestedSystemResultCount).toBe(result.data?.nestedSystemResults.length);
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

  it("creates execution sessions and supports async polling/result retrieval", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:async",
      versionId: "system:async:v1",
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

    const runtimeApi = new SystemRuntimeBackendApi(repository);
    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:async:v1",
      systemId: "system:async",
      inputPayload: { request: "hello" },
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "user-async", sessionId: "caller-session-1" },
      },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.acceptedState).toBe("accepted");
    expect(started.data?.sessionId).toBeDefined();
    expect(started.data?.executionId).toBeDefined();

    let poll = await runtimeApi.pollExecution({
      sessionId: started.data?.sessionId,
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "user-async" },
      },
    });
    expect(poll.ok).toBeTrue();
    expect(poll.data?.executionId).toBe(started.data?.executionId);
    expect(["running", "completed", "failed"]).toContain(poll.data?.acceptedState);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      poll = await runtimeApi.pollExecution({
        executionId: started.data?.executionId,
        requestContext: {
          trustedInternal: true,
          accessContext: { callerKind: "user", callerId: "user-async" },
        },
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    const session = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "user-async" },
    });
    expect(session.ok).toBeTrue();
    expect(session.data?.executionIds).toContain(started.data?.executionId);
    expect(session.data?.context?.callerId).toBe("user-async");
    expect(session.data?.context?.callerSessionId).toBe("caller-session-1");

    const result = await runtimeApi.getExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    expect(result.data?.executionId).toBe(started.data?.executionId);
  });

  it("applies tenant-scoped isolation for async session and execution retrieval", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:tenant",
      versionId: "system:tenant:v1",
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

    const runtimeApi = new SystemRuntimeBackendApi(repository);
    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:tenant:v1",
      systemId: "system:tenant",
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "tenant-user-a", metadata: { tenantId: "tenant-a" } },
        tenantId: "tenant-a",
      },
    });
    expect(started.ok).toBeTrue();

    const sessionAllowed = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "tenant-user-a", metadata: { tenantId: "tenant-a" } },
      tenantId: "tenant-a",
    });
    expect(sessionAllowed.ok).toBeTrue();
    expect(sessionAllowed.data?.context?.tenantId).toBe("tenant-a");

    const sessionDenied = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "tenant-user-b", metadata: { tenantId: "tenant-b" } },
      tenantId: "tenant-b",
    });
    expect(sessionDenied.ok).toBeFalse();
    expect(sessionDenied.error?.code).toBe("forbidden");

    const statusDenied = await runtimeApi.pollExecution({
      executionId: started.data!.executionId,
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "tenant-user-b", metadata: { tenantId: "tenant-b" } },
        tenantId: "tenant-b",
      },
    });
    expect(statusDenied.ok).toBeFalse();
    expect(statusDenied.error?.code).toBe("forbidden");

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const poll = await runtimeApi.pollExecution({
        executionId: started.data!.executionId,
        requestContext: {
          trustedInternal: true,
          accessContext: { callerKind: "user", callerId: "tenant-user-a", metadata: { tenantId: "tenant-a" } },
          tenantId: "tenant-a",
        },
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    const resultDenied = await runtimeApi.getExecutionResult(started.data!.executionId, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "tenant-user-b", metadata: { tenantId: "tenant-b" } },
      tenantId: "tenant-b",
    });
    expect(resultDenied.ok).toBeFalse();
    expect(resultDenied.error?.code).toBe("forbidden");
  });

  it("registers callbacks on async start and dispatches accepted/completed events with bounded payload summaries", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:callback",
      versionId: "system:callback:v1",
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
    const callbackDispatcher = new RecordingCallbackDispatcher(false);
    const runtimeApi = new SystemRuntimeBackendApi(repository, undefined, undefined, undefined, undefined, undefined, callbackDispatcher);

    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:callback:v1",
      callback: {
        targetUrl: "https://callbacks.example.test/hook",
        includeResultSummary: true,
      },
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "callback-user" },
      },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.sessionId).toBeDefined();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const session = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "callback-user" },
      });
      if (session.ok && (session.data?.status === "completed" || session.data?.status === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    expect(callbackDispatcher.deliveries.some((entry) => entry.payload.eventKind === "execution-accepted")).toBeTrue();
    expect(callbackDispatcher.deliveries.some((entry) => entry.payload.eventKind === "execution-completed")).toBeTrue();
    const completed = callbackDispatcher.deliveries.find((entry) => entry.payload.eventKind === "execution-completed");
    expect(completed?.payload.summary?.outputSummary).toBeDefined();

    const session = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "callback-user" },
    });
    expect(session.ok).toBeTrue();
    expect((session.data?.callbacks?.length ?? 0) > 0).toBeTrue();
    expect((session.data?.callbackDeliveries?.length ?? 0) >= 2).toBeTrue();
  });

  it("surfaces callback delivery failures predictably without breaking async polling fallback", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:callback-fail",
      versionId: "system:callback-fail:v1",
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
    const runtimeApi = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new RecordingCallbackDispatcher(true),
    );

    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:callback-fail:v1",
      callback: {
        targetUrl: "https://callbacks.example.test/hook",
        includeResultSummary: false,
      },
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "callback-user-2" },
      },
    });
    expect(started.ok).toBeTrue();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const poll = await runtimeApi.pollExecution({
        executionId: started.data!.executionId,
        requestContext: {
          trustedInternal: true,
          accessContext: { callerKind: "user", callerId: "callback-user-2" },
        },
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    const session = await runtimeApi.getExecutionSession(started.data!.sessionId!, {
      trustedInternal: true,
      accessContext: { callerKind: "user", callerId: "callback-user-2" },
    });
    expect(session.ok).toBeTrue();
    expect(session.data?.callbackDeliveries?.some((entry) => entry.succeeded === false)).toBeTrue();

    const result = await runtimeApi.getExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
  });

  it("streams bounded execution updates derived from runtime status/trace while preserving polling", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:stream",
      versionId: "system:stream:v1",
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
    const runtimeApi = new SystemRuntimeBackendApi(repository);
    const events: Array<{ kind: string; executionId: string }> = [];

    const started = await runtimeApi.startExecutionAsync({
      versionId: "system:stream:v1",
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "stream-user" },
      },
    });
    expect(started.ok).toBeTrue();

    const subscription = runtimeApi.subscribeToExecutionUpdates({
      executionId: started.data!.executionId,
      requestContext: {
        trustedInternal: true,
        accessContext: { callerKind: "user", callerId: "stream-user" },
      },
      listener: (event) => {
        events.push({ kind: event.kind, executionId: event.executionId });
      },
    });
    expect(subscription.ok).toBeTrue();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const poll = await runtimeApi.pollExecution({
        executionId: started.data!.executionId,
        requestContext: {
          trustedInternal: true,
          accessContext: { callerKind: "user", callerId: "stream-user" },
        },
      });
      if (poll.ok && (poll.data?.acceptedState === "completed" || poll.data?.acceptedState === "failed")) {
        break;
      }
      await Bun.sleep(5);
    }

    subscription.data?.unsubscribe();
    expect(events.some((event) => event.kind === ExecutionUpdateEventKinds.executionStatus)).toBeTrue();
    expect(events.some((event) => event.kind === ExecutionUpdateEventKinds.executionTrace)).toBeTrue();
    expect(events.some((event) => event.kind === ExecutionUpdateEventKinds.executionCompleted || event.kind === ExecutionUpdateEventKinds.executionFailed)).toBeTrue();
  });

  it("returns structured runtime input validation errors before orchestration", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:validated",
      versionId: "system:validated:v1",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
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

    const runtimeApi = new SystemRuntimeBackendApi(repository);
    const invalid = await runtimeApi.startExecution({
      versionId: "system:validated:v1",
      inputPayload: {},
    });

    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");
    expect(invalid.error?.validationErrors?.some((entry) => entry.code === "missing-required-input")).toBeTrue();
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

  it("keeps lifecycle/status/result coherent across sqlite persistence reload for nested executions", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-runtime-backend-reload-"));
    try {
      const studioDatabasePath = path.join(root, "studio-shell.sqlite");
      const runtimeDatabasePath = path.join(root, "system-runtime.sqlite");
      const repository = new SqliteStudioShellRepository(studioDatabasePath);
      const runtimeStore = new SqliteSystemRuntimeExecutionStore(runtimeDatabasePath);
      const runtimeApi = new SystemRuntimeBackendApi(repository, runtimeStore);

      await repository.saveAssetVersion(new AssetVersion({
        assetId: "system:nested",
        versionId: "system:nested:v1",
        metadata: {
          metadata: {
            taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
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
      await repository.saveAssetVersion(new AssetVersion({
        assetId: "system:root",
        versionId: "system:root:v1",
        metadata: {
          metadata: {
            taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
          },
          content: JSON.stringify({
            systemSpec: {
              components: [
                {
                  componentKind: "system",
                  alias: "nested",
                  assetId: "system:nested",
                  versionId: "system:nested:v1",
                  taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
                },
              ],
              nestedSystems: [{ alias: "nested", assetId: "system:nested", versionId: "system:nested:v1" }],
              inputs: [{ inputId: "request", valueType: "string", required: true }],
              outputs: [{ outputId: "response", valueType: "string" }],
            },
          }),
          dependencies: [],
        },
      }));

      const started = await runtimeApi.startExecution({
        versionId: "system:root:v1",
        maxDepth: 4,
      });
      expect(started.ok).toBeTrue();
      expect(started.data?.executionId).toBeDefined();

      const status = await runtimeApi.getExecutionStatus(started.data!.executionId);
      expect(status.ok).toBeTrue();
      expect(status.data?.nestedSystems.length).toBeGreaterThan(0);

      const trace = await runtimeApi.getExecutionTrace({ executionId: started.data!.executionId });
      expect(trace.ok).toBeTrue();
      expect((trace.data?.trace.events.length ?? 0) > 0).toBeTrue();

      const result = await runtimeApi.getExecutionResult(started.data!.executionId);
      expect(result.ok).toBeTrue();
      expect(result.data?.nestedSystemResults.length).toBeGreaterThan(0);
      expect(result.data?.nestedExecutionLineage.length).toBeGreaterThan(0);
      expect(result.data?.nestedExecutionLineage[0]?.parentExecutionId).toBe(started.data?.executionId);
      expect(started.data?.nestedExecutionLineage.length).toBeGreaterThan(0);

      repository.dispose();

      const reopenedRepository = new SqliteStudioShellRepository(studioDatabasePath);
      const reopenedRuntimeApi = new SystemRuntimeBackendApi(
        reopenedRepository,
        new SqliteSystemRuntimeExecutionStore(runtimeDatabasePath),
      );

      const reloadedStatus = await reopenedRuntimeApi.getExecutionStatus(started.data!.executionId);
      expect(reloadedStatus.ok).toBeTrue();
      expect(reloadedStatus.data?.executionId).toBe(started.data?.executionId);

      const reloadedResult = await reopenedRuntimeApi.getExecutionResult(started.data!.executionId);
      expect(reloadedResult.ok).toBeTrue();
      expect(reloadedResult.data?.executedVersionMap.rootVersionId).toBe("system:root:v1");

      const recent = await reopenedRuntimeApi.listRecentExecutionsForSystem({
        assetId: "system:root",
        versionId: "system:root:v1",
      });
      expect(recent.ok).toBeTrue();
      expect(recent.data?.[0]?.executionId).toBe(started.data?.executionId);

      reopenedRepository.dispose();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("executes mixed atomic/composite/system nodes and reports bounded interop failures truthfully", async () => {
    const repository = new InMemoryStudioShellRepository();
    const runtimeApi = new SystemRuntimeBackendApi(repository);

    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:child",
      versionId: "system:child:v3",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
        content: JSON.stringify({
          systemSpec: {
            components: [
              {
                componentKind: "atomic",
                alias: "child-model",
                assetId: "asset:model:child",
                versionId: "asset:model:child:v1",
                taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
              },
            ],
            inputs: [{ inputId: "request", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [{ assetId: "asset:model:child", versionId: "asset:model:child:v1" }],
      },
    }));

    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:mixed",
      versionId: "system:mixed:v5",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
        content: JSON.stringify({
          systemSpec: {
            components: [
              {
                componentKind: "atomic",
                alias: "model",
                assetId: "asset:model",
                versionId: "asset:model:v2",
                taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
              },
              {
                componentKind: "composite",
                alias: "workflow",
                assetId: "asset:workflow",
                versionId: "asset:workflow:v7",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
              },
              {
                componentKind: "system",
                alias: "child-system",
                assetId: "system:child",
                versionId: "system:child:v3",
                taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
              },
            ],
            nestedSystems: [{ alias: "child-system", assetId: "system:child", versionId: "system:child:v3" }],
            inputs: [{ inputId: "request", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [
          { assetId: "asset:model", versionId: "asset:model:v2" },
          { assetId: "asset:workflow", versionId: "asset:workflow:v7" },
          { assetId: "system:child", versionId: "system:child:v3" },
        ],
      },
    }));

    const started = await runtimeApi.startExecution({ versionId: "system:mixed:v5", maxDepth: 4 });
    expect(started.ok).toBeTrue();

    const status = await runtimeApi.getExecutionStatus(started.data!.executionId);
    expect(status.ok).toBeTrue();
    const structuralKinds = new Set(status.data?.nodeStatuses.map((node) => node.structuralKind) ?? []);
    expect(structuralKinds.has("atomic")).toBeTrue();
    expect(structuralKinds.has("composite")).toBeTrue();
    expect(structuralKinds.has("system")).toBeTrue();
    expect(status.data?.nestedSystems.length).toBeGreaterThan(0);

    const result = await runtimeApi.getExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    const resultKinds = new Set(result.data?.nodeResults.map((node) => node.structuralKind) ?? []);
    expect(resultKinds.has("atomic")).toBeTrue();
    expect(resultKinds.has("composite")).toBeTrue();
    expect(resultKinds.has("system")).toBeTrue();
    expect(result.data?.nestedSystemResults.length).toBeGreaterThan(0);
    expect(Object.values(result.data?.executedVersionMap.nodeVersionIds ?? {})).toEqual(expect.arrayContaining([
      "asset:model:v2",
      "asset:workflow:v7",
      "system:child:v3",
    ]));

    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:invalid-mixed",
      versionId: "system:invalid-mixed:v1",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
        content: JSON.stringify({
          systemSpec: {
            components: [
              {
                componentKind: "composite",
                alias: "workflow",
                assetId: "asset:workflow",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
              },
            ],
            inputs: [{ inputId: "request", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));

    const rejected = await runtimeApi.startExecution({ versionId: "system:invalid-mixed:v1" });
    expect(rejected.ok).toBeFalse();
    expect(rejected.error?.code).toBe("invalid-request");
    expect(rejected.error?.message).toContain("pinned component versions");
  });

  it("writes durable execution audit records for external request lifecycle with nested attribution", async () => {
    const repository = new InMemoryStudioShellRepository();
    const auditRepository = new InMemoryExecutionAuditRepository();
    const runtimeApi = new SystemRuntimeBackendApi(repository, undefined, undefined, undefined, undefined, undefined, undefined, auditRepository);

    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:audit-child",
      versionId: "system:audit-child:v1",
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
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:audit-root",
      versionId: "system:audit-root:v1",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
        content: JSON.stringify({
          systemSpec: {
            components: [
              {
                componentKind: "system",
                alias: "child",
                assetId: "system:audit-child",
                versionId: "system:audit-child:v1",
                taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
              },
            ],
            nestedSystems: [{ alias: "child", assetId: "system:audit-child", versionId: "system:audit-child:v1" }],
            inputs: [{ inputId: "request", valueType: "string", required: false }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));

    const started = await runtimeApi.startExecution({
      versionId: "system:audit-root:v1",
      systemId: "system:audit-root",
      requestContext: {
        requireAuthentication: false,
        accessContext: {
          callerKind: "user",
          callerId: "audit-user-1",
          sessionId: "audit-session-1",
          metadata: { tenantId: "tenant-audit" },
        },
        tenantId: "tenant-audit",
        requestSource: "external-api",
      },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.nestedExecutionLineage.length).toBeGreaterThan(0);

    const audit = await runtimeApi.getExecutionAuditTrail({
      executionId: started.data!.executionId,
      requestContext: {
        requireAuthentication: false,
        accessContext: { callerKind: "user", callerId: "audit-user-1", metadata: { tenantId: "tenant-audit" } },
        tenantId: "tenant-audit",
      },
    });
    expect(audit.ok).toBeTrue();
    const eventKinds = audit.data?.map((entry) => entry.eventKind) ?? [];
    expect(eventKinds).toEqual(expect.arrayContaining([
      ExecutionAuditEventKinds.requested,
      ExecutionAuditEventKinds.accepted,
      ExecutionAuditEventKinds.completed,
    ]));
    const completed = audit.data?.find((entry) => entry.eventKind === ExecutionAuditEventKinds.completed);
    expect(completed?.requestSource).toBe("external-api");
    expect(completed?.caller.callerId).toBe("audit-user-1");
    expect(completed?.tenant.tenantId).toBe("tenant-audit");
    expect(completed?.execution.versionId).toBe("system:audit-root:v1");
    expect((completed?.execution.childExecutionIds?.length ?? 0) > 0).toBeTrue();
  });
});
