import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "@domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "@domain/assets/AssetVersion";
import {
  RuntimeAccessControlService,
  type ExecutionAccessDecision,
  type ExecutionAccessPolicy,
  type ExecutionAccessRequest,
} from "@application/system-runtime/RuntimeAccessControlService";
import { ExecutionQuotaEvaluator } from "@application/system-runtime/ExecutionQuotaEvaluator";
import { StaticTokenRuntimeApiAuthenticator } from "../RuntimeApiAuthentication";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../ExternalSystemRuntimeInterface";
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

async function seedVersion(repository: InMemoryStudioShellRepository, versionId = "system:tool:v2"): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:tool",
    versionId,
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

describe("ToolInvocationBridge", () => {
  it("maps tool-style execution starts into the existing authenticated runtime path", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireUser1Policy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1", roles: ["external-runtime"] },
      }),
    );
    const bridge = new ToolInvocationBridge(new ExternalSystemRuntimeInterface(backend));

    const started = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      toolName: "mcp.system-runtime.run",
      systemId: "system:tool",
      versionId: "system:tool:v2",
      async: true,
      inputPayload: { request: "hello" },
      invocationContext: {
        protocol: "mcp",
        authentication: { bearerToken: "token-user-1" },
      },
    });

    expect(started.ok).toBeTrue();
    expect(started.data?.execution.executionId).toBeDefined();
    expect(started.data?.execution.acceptedState).toBe("accepted");
    expect(started.data?.execution.versionId).toBe("system:tool:v2");

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const status = await bridge.invoke({
        action: ExternalToolInvocationActions.getExecutionStatus,
        executionId: started.data!.execution.executionId,
        invocationContext: { authentication: { bearerToken: "token-user-1" } },
      });
      if (status.ok) {
        break;
      }
      await Bun.sleep(5);
    }

    let result = await bridge.invoke({
      action: ExternalToolInvocationActions.getExecutionResult,
      executionId: started.data!.execution.executionId,
      nodeResultLimit: 1,
      diagnosticsLimit: 1,
      invocationContext: { authentication: { bearerToken: "token-user-1" } },
    });

    for (let attempt = 0; attempt < 30 && !result.ok; attempt += 1) {
      await Bun.sleep(5);
      result = await bridge.invoke({
        action: ExternalToolInvocationActions.getExecutionResult,
        executionId: started.data!.execution.executionId,
        nodeResultLimit: 1,
        diagnosticsLimit: 1,
        invocationContext: { authentication: { bearerToken: "token-user-1" } },
      });
    }

    expect(result.ok).toBeTrue();
    expect(typeof result.data?.bounded.nodeResultsTruncated).toBe("boolean");
    expect(typeof result.data?.bounded.diagnosticsTruncated).toBe("boolean");
    expect(result.data?.execution.versionId).toBe("system:tool:v2");
  });

  it("preserves auth/access/quota/validation behavior through the tool bridge", async () => {
    const repository = new InMemoryStudioShellRepository();
    await seedVersion(repository);
    const backend = new SystemRuntimeBackendApi(
      repository,
      undefined,
      new RuntimeAccessControlService(new RequireUser1Policy()),
      new StaticTokenRuntimeApiAuthenticator({
        "token-user-1": { callerKind: "user", callerId: "user-1" },
        "token-user-2": { callerKind: "user", callerId: "user-2" },
      }),
      new ExecutionQuotaEvaluator({ maxConcurrentExecutionsPerCaller: 1, maxExecutionsPerWindow: 1, windowMs: 60_000 }),
    );
    const bridge = new ToolInvocationBridge(new ExternalSystemRuntimeInterface(backend), 64);

    const unauthorized = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
    });
    expect(unauthorized.ok).toBeFalse();
    expect(unauthorized.error?.code).toBe("unauthorized");

    const forbidden = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      invocationContext: {
        authentication: { bearerToken: "token-user-2" },
      },
    });
    expect(forbidden.ok).toBeFalse();
    expect(forbidden.error?.code).toBe("forbidden");

    const invalidInput = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      inputPayload: { request: "x".repeat(512) },
      invocationContext: {
        authentication: { bearerToken: "token-user-1" },
        callerContext: { callerKind: "user", callerId: "user-1" },
      },
    });
    expect(invalidInput.ok).toBeFalse();
    expect(invalidInput.error?.code).toBe("invalid-request");

    const accepted = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      invocationContext: {
        authentication: { bearerToken: "token-user-1" },
        callerContext: { callerKind: "user", callerId: "user-1" },
      },
    });
    expect(accepted.ok).toBeTrue();

    const blockedByQuota = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      invocationContext: {
        authentication: { bearerToken: "token-user-1" },
        callerContext: { callerKind: "user", callerId: "user-1" },
      },
    });
    expect(blockedByQuota.ok).toBeFalse();
    expect(blockedByQuota.error?.code).toBe("quota-exceeded");
  });

  it("enforces bounded environment selection and tenant isolation through tool invocations", async () => {
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
    const bridge = new ToolInvocationBridge(new ExternalSystemRuntimeInterface(backend), 64 * 1024);

    const started = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      requestedEnvironment: { option: "local", configuration: { requireNestedSystems: true } },
      tenantId: "tenant-a",
      invocationContext: {
        authentication: { bearerToken: "tenant-a-token" },
      },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.payload.executionEnvironment).toBeDefined();

    const invalidEnvironment = await bridge.invoke({
      action: ExternalToolInvocationActions.startExecution,
      systemId: "system:tool",
      versionId: "system:tool:v2",
      requestedEnvironment: { option: "invalid" as never },
      invocationContext: {
        authentication: { bearerToken: "tenant-a-token" },
      },
    });
    expect(invalidEnvironment.ok).toBeFalse();
    expect(invalidEnvironment.error?.code).toBe("invalid-request");

    const statusDenied = await bridge.invoke({
      action: ExternalToolInvocationActions.getExecutionStatus,
      executionId: started.data!.execution.executionId,
      tenantId: "tenant-b",
      invocationContext: {
        authentication: { bearerToken: "tenant-b-token" },
      },
    });
    expect(statusDenied.ok).toBeFalse();
    expect(statusDenied.error?.code).toBe("forbidden");
  });
});

