import { ResolveCertificateRevocationStatusUseCase } from "@application/security/use-cases/ResolveCertificateRevocationStatusUseCase";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "@application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import type {
  IManagedServerTlsRuntimeMaterialResolverPort,
  ManagedServerTlsRuntimeMaterial,
  ResolveManagedServerTlsRuntimeMaterialInput,
} from "@application/security/ports/SecurityMaterialResolutionPorts";
import { TrustMaterialKinds } from "@domain/security/CertificateAuthorityDomain";
import type { SqliteCertificateAuthorityPersistenceAdapter } from "@infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "@infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import { RuntimeTrustMaterialDistributionService } from "@infrastructure/security/certificates/RuntimeTrustMaterialDistributionService";
import type { FileSystemProtectedSecretStore } from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";

export interface ManagedServerTlsRuntimeMaterialResolverInput {
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly protectedSecretStore: FileSystemProtectedSecretStore | undefined;
}

export class ManagedServerTlsRuntimeMaterialResolver implements IManagedServerTlsRuntimeMaterialResolverPort {
  public constructor(private readonly dependencies: ManagedServerTlsRuntimeMaterialResolverInput) {}

  public async resolveManagedServerTlsRuntimeMaterial(
    input: ResolveManagedServerTlsRuntimeMaterialInput,
  ): Promise<ManagedServerTlsRuntimeMaterial> {
    if (!this.dependencies.protectedSecretStore) {
      throw new Error("Managed identity-server TLS requires protected secret storage configuration.");
    }

    const certificateMaterialStorage = new ProtectedCertificateAuthorityRootMaterialStorage(
      this.dependencies.protectedSecretStore,
    );
    const runtimeTrustMaterialDistributionService = new RuntimeTrustMaterialDistributionService({
      certificateAuthorityRepository: this.dependencies.certificateAuthorityRepository,
      issuedCertificateRepository: this.dependencies.certificateAuthorityRepository,
      trustMaterialReferenceRepository: this.dependencies.certificateAuthorityRepository,
      certificateMaterialStorage,
      certificateLifecycleEventRepository: this.dependencies.certificateAuthorityRepository,
    });
    const resolveRuntimeTrustMaterialPackageUseCase = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: runtimeTrustMaterialDistributionService,
    });

    const runtimeTrustPackage = await resolveRuntimeTrustMaterialPackageUseCase.execute({
      operationKey: `identity-server-managed-tls-runtime-package:${input.targetReferenceId}:${Date.now()}`,
      actorUserIdentityId: input.actorUserIdentityId,
      targetKind: "server",
      targetReferenceId: input.targetReferenceId,
      workspaceId: normalizeOptional(input.workspaceId),
      certificateAuthorityId: normalizeOptional(input.certificateAuthorityId),
      serialNumber: normalizeOptional(input.serialNumber),
      includeLeafCertificate: true,
      includeCertificateChain: true,
      includeTrustBundle: true,
    });

    if (!runtimeTrustPackage.ok) {
      throw new Error(
        `Managed identity-server TLS startup failed: runtime trust package retrieval failed (${runtimeTrustPackage.error.code}).`,
      );
    }

    if (!runtimeTrustPackage.value.serialNumber) {
      throw new Error("Managed identity-server TLS startup failed: server runtime trust package is missing serialNumber.");
    }

    const revocationStatusUseCase = new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: this.dependencies.certificateAuthorityRepository,
      certificateLifecycleEventRepository: this.dependencies.certificateAuthorityRepository,
    });
    const revocationStatus = await revocationStatusUseCase.resolveCertificateRevocationStatus({
      serialNumber: runtimeTrustPackage.value.serialNumber,
    });
    if (!revocationStatus.usable || revocationStatus.status !== "active") {
      throw new Error(
        `Managed identity-server TLS startup failed: server certificate '${runtimeTrustPackage.value.serialNumber}' is not usable (status='${revocationStatus.status}').`,
      );
    }

    const privateKeyMaterial = await this.dependencies.certificateAuthorityRepository.findTrustMaterialByRef(
      input.privateKeyMaterialRef,
    );
    if (!privateKeyMaterial) {
      throw new Error("Managed identity-server TLS startup failed: private key trust material is unavailable.");
    }

    if (privateKeyMaterial.kind !== TrustMaterialKinds.privateKeyEncryptedPem) {
      throw new Error("Managed identity-server TLS startup failed: private key trust material kind is invalid.");
    }

    const loadedPrivateKey = await certificateMaterialStorage.loadRootMaterials({
      certificateAuthorityId: runtimeTrustPackage.value.certificateAuthorityId,
      reason: "identity-server-managed-tls-startup",
      materials: [{
        materialRef: privateKeyMaterial.materialRef,
        kind: privateKeyMaterial.kind,
        secretRef: privateKeyMaterial.storageLocator,
      }],
    });
    const privateKeyPem = loadedPrivateKey[0]?.plaintextValue?.trim();
    if (!privateKeyPem) {
      throw new Error("Managed identity-server TLS startup failed: private key material is unavailable.");
    }

    const leafCertificatePem = runtimeTrustPackage.value.leafCertificatePem?.trim();
    if (!leafCertificatePem) {
      throw new Error("Managed identity-server TLS startup failed: leaf certificate material is unavailable.");
    }

    const certificateFragments = [
      leafCertificatePem,
      runtimeTrustPackage.value.certificateChainPem?.trim(),
    ].filter((value): value is string => Boolean(value && value.length > 0));

    return Object.freeze({
      certPem: `${certificateFragments.join("\n")}\n`,
      keyPem: `${privateKeyPem}\n`,
      caPem: runtimeTrustPackage.value.trustBundlePem?.trim()
        ? `${runtimeTrustPackage.value.trustBundlePem.trim()}\n`
        : undefined,
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
