import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
import {
  RuntimeAccessControlService,
  type ExecutionAccessDecision,
  type ExecutionAccessPolicy,
  type ExecutionAccessRequest,
} from "../../../../application/system-runtime/RuntimeAccessControlService";

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
        },
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    },
  }));
}

describe("ExternalSystemRuntimeInterface", () => {
  it("starts and reads execution through the existing runtime backend path", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(repository);
    const external = new ExternalSystemRuntimeInterface(backend);

    const started = await external.startExecution({
      systemId: "system:external",
      versionId: "system:external:v1",
      inputPayload: { request: "hello" },
      callerContext: { callerKind: "system", callerId: "external-client" },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.systemId).toBe("system:external");
    expect(started.data?.versionId).toBe("system:external:v1");
    expect(started.data?.executedVersionMap.rootVersionId).toBe("system:external:v1");

    const status = await external.getExecutionStatus(started.data!.executionId);
    expect(status.ok).toBeTrue();
    expect(status.data?.rootAssetId).toBe("system:external");

    const trace = await external.getExecutionTrace({
      executionId: started.data!.executionId,
      eventLimit: 3,
      logLimit: 2,
    });
    expect(trace.ok).toBeTrue();
    expect((trace.data?.trace.events.length ?? 0) <= 3).toBeTrue();
    expect((trace.data?.trace.logs.length ?? 0) <= 2).toBeTrue();

    const result = await external.getExecutionResult({
      executionId: started.data!.executionId,
      nodeResultLimit: 1,
      diagnosticsLimit: 1,
    });
    expect(result.ok).toBeTrue();
    expect((result.data?.nodeResults.length ?? 0) <= 1).toBeTrue();
    expect((result.data?.diagnostics.length ?? 0) <= 1).toBeTrue();
    expect(result.data?.bounded).toBeDefined();
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

  it("enforces access-control denials before runtime orchestration across backend and external entrypoints", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const access = new RuntimeAccessControlService(new DenyAllPolicy());
    const backend = new SystemRuntimeBackendApi(repository, undefined, access);
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
    });
    expect(deniedExternal.ok).toBeFalse();
    expect(deniedExternal.error?.code).toBe("forbidden");
    expect(deniedExternal.error?.message).toContain("cannot execute");
  });
});
