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
import { ResolveRuntimeTrustMaterialPackageUseCase } from "../use-cases/ResolveRuntimeTrustMaterialPackageUseCase";

class StubTrustMaterialDistributionPort implements ITrustMaterialDistributionPort {
  public lastResolveInput?: ResolveRuntimeTrustMaterialPackageInput;
  public resolveResult?: ResolveRuntimeTrustMaterialPackageResult;

  public async publishTrustBundle(_input: PublishTrustBundleInput): Promise<PublishTrustBundleResult> {
    throw new Error("not implemented");
  }

  public async resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined> {
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
});
