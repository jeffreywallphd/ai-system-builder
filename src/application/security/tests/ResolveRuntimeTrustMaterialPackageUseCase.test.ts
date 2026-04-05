import { describe, expect, it } from "bun:test";
import type {
  CertificateRuntimeTrustMaterialAuthorizationHook,
} from "../ports/CertificateRuntimeTrustMaterialAuthorizationPort";
import type {
  ITrustMaterialDistributionPort,
  PublishTrustBundleInput,
  PublishTrustBundleResult,
  ResolveRuntimeTrustMaterialPackageInput,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../ports/ITrustMaterialDistributionPort";
import {
  ResolveRuntimeTrustMaterialPackageUseCase,
  type ResolveRuntimeTrustMaterialPackageObservabilityEvent,
} from "../use-cases/ResolveRuntimeTrustMaterialPackageUseCase";

class StubTrustMaterialDistributionPort implements ITrustMaterialDistributionPort {
  public lastResolveInput?: ResolveRuntimeTrustMaterialPackageInput;
  public resolveResult?: ResolveRuntimeTrustMaterialPackageResult;
  public throwOnResolve?: Error;

  public async publishTrustBundle(_input: PublishTrustBundleInput): Promise<PublishTrustBundleResult> {
    throw new Error("not implemented");
  }

  public async resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined> {
    if (this.throwOnResolve) {
      throw this.throwOnResolve;
    }
    this.lastResolveInput = input;
    return this.resolveResult;
  }
}

class StubAuthorizationHook implements CertificateRuntimeTrustMaterialAuthorizationHook {
  public deny = false;
  public called = 0;

  public async assertCanResolveRuntimeTrustMaterialPackage(_input: {
    readonly actorUserIdentityId: string;
    readonly request: unknown;
  }): Promise<void> {
    this.called += 1;
    if (this.deny) {
      throw new Error("forbidden-runtime-trust-material");
    }
  }
}

class CapturingObservabilityHook {
  public readonly events: ResolveRuntimeTrustMaterialPackageObservabilityEvent[] = [];

  public async onEvent(event: ResolveRuntimeTrustMaterialPackageObservabilityEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("ResolveRuntimeTrustMaterialPackageUseCase", () => {
  it("returns a scoped runtime package for authorized callers", async () => {
    const distributionPort = new StubTrustMaterialDistributionPort();
    const authorizationHook = new StubAuthorizationHook();
    distributionPort.resolveResult = Object.freeze({
      packageId: "runtime-trust-package:node:node:alpha",
      occurredAt: "2026-04-05T00:00:00.000Z",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      workspaceId: "workspace:alpha",
      leafCertificatePem: "-----BEGIN CERTIFICATE-----leaf-----END CERTIFICATE-----",
      certificateChainPem: "-----BEGIN CERTIFICATE-----chain-----END CERTIFICATE-----",
      trustBundlePem: "-----BEGIN CERTIFICATE-----bundle-----END CERTIFICATE-----",
      protectedReferences: Object.freeze([{
        materialRef: "trust:cert:node:alpha:v1",
        kind: "certificate-pem",
        accessRef: "secret-store:internal-ca:node-alpha-cert",
        accessRefRedacted: "[redacted]",
      }]),
    });

    const useCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distributionPort,
      authorizationHook,
    });

    const result = await useCase.execute({
      operationKey: " runtime-material-op-1 ",
      actorUserIdentityId: "user:runtime-service",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      workspaceId: "workspace:alpha",
      includeProtectedReferences: true,
      occurredAt: "2026-04-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful runtime trust material result.");
    }

    expect(result.value.targetReferenceId).toBe("node:alpha");
    expect(result.value.protectedReferences).toHaveLength(1);
    expect(authorizationHook.called).toBe(1);
    expect(distributionPort.lastResolveInput?.operationKey).toBe("runtime-material-op-1");
  });

  it("returns forbidden when authorization rejects the request", async () => {
    const distributionPort = new StubTrustMaterialDistributionPort();
    const authorizationHook = new StubAuthorizationHook();
    authorizationHook.deny = true;

    const useCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distributionPort,
      authorizationHook,
    });

    const result = await useCase.execute({
      operationKey: "runtime-material-op-2",
      actorUserIdentityId: "user:denied",
      targetKind: "server",
      targetReferenceId: "server:authoritative",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected forbidden result.");
    }
    expect(result.error.code).toBe("resolve-runtime-trust-material-package-forbidden");
    expect(result.error.message).toBe("Actor is not authorized to resolve runtime trust material package.");
  });

  it("returns not-found when no scoped package exists", async () => {
    const distributionPort = new StubTrustMaterialDistributionPort();
    const useCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distributionPort,
    });

    const result = await useCase.execute({
      operationKey: "runtime-material-op-3",
      actorUserIdentityId: "user:runtime-service",
      targetKind: "service",
      targetReferenceId: "service:missing",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected not-found result.");
    }
    expect(result.error.code).toBe("resolve-runtime-trust-material-package-not-found");
  });

  it("returns invalid-request for malformed retrieval inputs", async () => {
    const distributionPort = new StubTrustMaterialDistributionPort();
    const useCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distributionPort,
    });

    const result = await useCase.execute({
      operationKey: "runtime-material-op-4",
      actorUserIdentityId: "",
      targetKind: "node",
      targetReferenceId: "node:alpha",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid request result.");
    }
    expect(result.error.code).toBe("resolve-runtime-trust-material-package-invalid-request");
  });

  it("returns internal for unexpected distribution failures and emits redacted observability metadata", async () => {
    const distributionPort = new StubTrustMaterialDistributionPort();
    distributionPort.throwOnResolve = new Error("pem=-----BEGIN PRIVATE KEY-----");
    const observabilityHook = new CapturingObservabilityHook();

    const useCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distributionPort,
      observabilityHook: async (event) => observabilityHook.onEvent(event),
    });

    const result = await useCase.execute({
      operationKey: "runtime-material-op-5",
      actorUserIdentityId: "user:runtime-service",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      includeProtectedReferences: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected internal error result.");
    }

    expect(result.error.code).toBe("resolve-runtime-trust-material-package-internal");
    expect(result.error.message).toBe("Runtime trust material package resolution failed due to an internal error.");

    expect(observabilityHook.events).toHaveLength(1);
    const event = observabilityHook.events[0];
    expect(event.event).toBe("runtime-trust-material-package-resolve-failed");
    if (event.event === "runtime-trust-material-package-resolve-failed") {
      expect(event.code).toBe("resolve-runtime-trust-material-package-internal");
      expect((event.details as Record<string, unknown>)?.reason).not.toContain("PRIVATE KEY");
    }
  });
});
