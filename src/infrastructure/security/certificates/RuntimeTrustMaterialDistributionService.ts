import {
  CertificateDistributionEventStatuses,
  type CertificateDistributionTargetKind,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import {
  CertificateSubjectReferenceKinds,
  TrustMaterialKinds,
  type CertificateSubjectReferenceKind,
} from "../../../domain/security/CertificateAuthorityDomain";
import type { ICertificateAuthorityRootPersistenceRepository } from "../../../application/security/ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityRootMaterialStorage } from "../../../application/security/ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateLifecycleEventPersistenceRepository } from "../../../application/security/ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../../../application/security/ports/IIssuedCertificatePersistenceRepository";
import type {
  ITrustMaterialDistributionPort,
  PublishTrustBundleInput,
  PublishTrustBundleResult,
  ResolveRuntimeTrustMaterialPackageInput,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../../../application/security/ports/ITrustMaterialDistributionPort";
import type { ITrustMaterialReferencePersistenceRepository } from "../../../application/security/ports/ITrustMaterialReferencePersistenceRepository";
import type { TrustMaterialReferencePersistenceRecord } from "../../../shared/dto/security/CertificateAuthorityDtos";
import { redactSecretRef } from "../secrets/FileSystemProtectedSecretStore";

interface RuntimeTrustMaterialDistributionServiceDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly trustMaterialReferenceRepository: ITrustMaterialReferencePersistenceRepository;
  readonly certificateMaterialStorage: ICertificateAuthorityRootMaterialStorage;
  readonly certificateLifecycleEventRepository?: ICertificateLifecycleEventPersistenceRepository;
}

export class RuntimeTrustMaterialDistributionService implements ITrustMaterialDistributionPort {
  public constructor(private readonly dependencies: RuntimeTrustMaterialDistributionServiceDependencies) {}

  public async publishTrustBundle(input: PublishTrustBundleInput): Promise<PublishTrustBundleResult> {
    const publishedAt = new Date().toISOString();
    if (this.dependencies.certificateLifecycleEventRepository) {
      await this.dependencies.certificateLifecycleEventRepository.saveCertificateDistributionEvent({
        mutation: {
          operationKey: `publish-trust-bundle:${input.trustBundleRef}:${input.targetKind}:${input.targetRef}:${publishedAt}`,
          context: {
            actorUserIdentityId: input.actorUserIdentityId,
            occurredAt: publishedAt,
          },
        },
        record: Object.freeze({
          distributionEventId: `distribution:${input.targetKind}:${input.targetRef}:${Date.parse(publishedAt)}`,
          materialRef: input.trustBundleRef,
          certificateAuthorityId: input.certificateAuthorityId,
          targetKind: input.targetKind,
          targetReferenceId: input.targetRef,
          transport: `trust-material-${input.distributionChannel}`,
          status: CertificateDistributionEventStatuses.published,
          occurredAt: publishedAt,
          occurredBy: input.actorUserIdentityId,
          createdAt: publishedAt,
          createdBy: input.actorUserIdentityId,
          lastModifiedAt: publishedAt,
          lastModifiedBy: input.actorUserIdentityId,
          revision: 0,
        }),
      });
    }

    return Object.freeze({
      trustBundleRef: input.trustBundleRef,
      publishedAt,
      versionTag: undefined,
    });
  }

  public async resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined> {
    const normalized = normalizeResolveInput(input);

    const targetScope = toTargetScope(normalized.targetKind, normalized.targetReferenceId, normalized.workspaceId);
    const certificate = normalized.serialNumber
      ? await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(normalized.serialNumber)
      : await this.dependencies.issuedCertificateRepository.findLatestIssuedCertificateBySubjectReference(targetScope);

    if (certificate && !isCertificateScopedToTarget(certificate, targetScope)) {
      return undefined;
    }

    const requiresIssuedCertificate = normalized.includeLeafCertificate
      || normalized.includeCertificateChain;
    if (requiresIssuedCertificate && !certificate) {
      return undefined;
    }

    const certificateAuthority = normalized.certificateAuthorityId
      ? await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(normalized.certificateAuthorityId)
      : certificate
        ? await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(certificate.certificateAuthorityId)
        : await this.dependencies.certificateAuthorityRepository.findActiveCertificateAuthority(normalized.occurredAt);

    if (!certificateAuthority) {
      return undefined;
    }
    if (certificate && certificate.certificateAuthorityId !== certificateAuthority.certificateAuthorityId) {
      return undefined;
    }

    const refs = new Set<string>();
    const leafRef = certificate?.certificateMaterialRef;
    const chainRef = certificate?.certificateChainMaterialRef;
    const trustBundleRef = certificate?.trustMaterialRef;

    if (normalized.includeLeafCertificate && leafRef) {
      refs.add(leafRef);
    }
    if (normalized.includeCertificateChain && chainRef) {
      refs.add(chainRef);
    }
    if (normalized.includeTrustBundle) {
      refs.add(certificateAuthority.rootCertificateMaterialRef);
      if (chainRef) {
        refs.add(chainRef);
      } else if (trustBundleRef) {
        refs.add(trustBundleRef);
      }
    }
    if (normalized.includeProtectedReferences) {
      refs.add(certificateAuthority.rootCertificateMaterialRef);
      if (certificate) {
        refs.add(certificate.certificateMaterialRef);
        if (certificate.certificateChainMaterialRef) {
          refs.add(certificate.certificateChainMaterialRef);
        }
      }
    }

    const materialRecords = await this.loadMaterialRecords([...refs]);
    if (!materialRecords) {
      return undefined;
    }

    const shouldLoadPlaintext = normalized.includeLeafCertificate
      || normalized.includeCertificateChain
      || normalized.includeTrustBundle;
    const loadedByRef = shouldLoadPlaintext
      ? await this.loadPlaintextMaterials(materialRecords, normalized.certificateAuthorityId)
      : new Map<string, string>();
    const leafCertificatePem = normalized.includeLeafCertificate && leafRef
      ? loadedByRef.get(leafRef)
      : undefined;
    const certificateChainPem = normalized.includeCertificateChain
      ? this.resolveCertificateChainPem({
        materialRecords,
        loadedByRef,
        chainRef,
        trustBundleRef,
      })
      : undefined;
    const trustBundlePem = normalized.includeTrustBundle
      ? this.resolveTrustBundlePem({
        materialRecords,
        loadedByRef,
        rootRef: certificateAuthority.rootCertificateMaterialRef,
        chainRef,
        trustBundleRef,
      })
      : undefined;

    if (normalized.includeLeafCertificate && !leafCertificatePem) {
      return undefined;
    }
    if (normalized.includeCertificateChain && !certificateChainPem) {
      return undefined;
    }
    if (normalized.includeTrustBundle && !trustBundlePem) {
      return undefined;
    }

    const protectedReferences = normalized.includeProtectedReferences
      ? materialRecords.map((record) => Object.freeze({
        materialRef: record.materialRef,
        kind: record.kind,
        accessRef: record.storageLocator,
        accessRefRedacted: redactAccessRef(record.storageLocator),
        fingerprintSha256: record.fingerprintSha256,
      }))
      : Object.freeze([]);

    const packageResult = Object.freeze({
      packageId: toPackageId({
        targetKind: normalized.targetKind,
        targetReferenceId: normalized.targetReferenceId,
        certificateAuthorityId: certificateAuthority.certificateAuthorityId,
        serialNumber: certificate?.serialNumber,
        occurredAt: normalized.occurredAt,
      }),
      occurredAt: normalized.occurredAt,
      certificateAuthorityId: certificateAuthority.certificateAuthorityId,
      serialNumber: certificate?.serialNumber,
      targetKind: normalized.targetKind,
      targetReferenceId: normalized.targetReferenceId,
      workspaceId: normalized.workspaceId,
      leafCertificatePem,
      certificateChainPem,
      trustBundlePem,
      protectedReferences: Object.freeze(protectedReferences),
    });

    if (this.dependencies.certificateLifecycleEventRepository && materialRecords.length > 0) {
      const primaryRef = materialRecords[0] as TrustMaterialReferencePersistenceRecord;
      await this.dependencies.certificateLifecycleEventRepository.saveCertificateDistributionEvent({
        mutation: {
          operationKey: `${normalized.operationKey}:runtime-package-distribution`,
          context: {
            actorUserIdentityId: normalized.actorUserIdentityId,
            occurredAt: normalized.occurredAt,
            reason: "runtime-trust-material-package",
          },
        },
        record: Object.freeze({
          distributionEventId: `distribution:${normalized.targetKind}:${normalized.targetReferenceId}:${Date.parse(normalized.occurredAt)}`,
          materialRef: primaryRef.materialRef,
          certificateAuthorityId: certificateAuthority.certificateAuthorityId,
          serialNumber: certificate?.serialNumber,
          targetKind: normalized.targetKind,
          targetReferenceId: normalized.targetReferenceId,
          workspaceId: normalized.workspaceId,
          transport: "runtime-trust-material-retrieval",
          status: CertificateDistributionEventStatuses.published,
          occurredAt: normalized.occurredAt,
          occurredBy: normalized.actorUserIdentityId,
          createdAt: normalized.occurredAt,
          createdBy: normalized.actorUserIdentityId,
          lastModifiedAt: normalized.occurredAt,
          lastModifiedBy: normalized.actorUserIdentityId,
          revision: 0,
        }),
      });
    }

    return packageResult;
  }

  private async loadMaterialRecords(
    refs: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord> | undefined> {
    if (refs.length === 0) {
      return Object.freeze([]);
    }

    const output: TrustMaterialReferencePersistenceRecord[] = [];
    for (const ref of refs) {
      const record = await this.dependencies.trustMaterialReferenceRepository.findTrustMaterialByRef(ref);
      if (!record) {
        return undefined;
      }
      output.push(record);
    }

    output.sort((left, right) => left.materialRef.localeCompare(right.materialRef));
    return Object.freeze(output);
  }

  private async loadPlaintextMaterials(
    records: ReadonlyArray<TrustMaterialReferencePersistenceRecord>,
    certificateAuthorityIdInput?: string,
  ): Promise<ReadonlyMap<string, string>> {
    const loadable = records.filter((record) => (
      record.kind === TrustMaterialKinds.certificatePem
      || record.kind === TrustMaterialKinds.certificateChainPem
      || record.kind === TrustMaterialKinds.crlPem
    ));
    if (loadable.length === 0) {
      return new Map<string, string>();
    }

    const certificateAuthorityId = certificateAuthorityIdInput ?? "runtime-trust-material";
    const loaded = await this.dependencies.certificateMaterialStorage.loadRootMaterials({
      certificateAuthorityId,
      reason: "runtime-trust-material-package",
      materials: loadable.map((record) => Object.freeze({
        materialRef: record.materialRef,
        kind: record.kind,
        secretRef: record.storageLocator,
      })),
    });

    return new Map(loaded.map((item) => [item.materialRef, item.plaintextValue] as const));
  }

  private resolveCertificateChainPem(input: {
    readonly materialRecords: ReadonlyArray<TrustMaterialReferencePersistenceRecord>;
    readonly loadedByRef: ReadonlyMap<string, string>;
    readonly chainRef?: string;
    readonly trustBundleRef?: string;
  }): string | undefined {
    if (input.chainRef) {
      return input.loadedByRef.get(input.chainRef);
    }
    if (!input.trustBundleRef) {
      return undefined;
    }

    const bundleRecord = input.materialRecords.find((record) => record.materialRef === input.trustBundleRef);
    if (!bundleRecord || bundleRecord.kind !== TrustMaterialKinds.certificateChainPem) {
      return undefined;
    }
    return input.loadedByRef.get(bundleRecord.materialRef);
  }

  private resolveTrustBundlePem(input: {
    readonly materialRecords: ReadonlyArray<TrustMaterialReferencePersistenceRecord>;
    readonly loadedByRef: ReadonlyMap<string, string>;
    readonly rootRef: string;
    readonly chainRef?: string;
    readonly trustBundleRef?: string;
  }): string | undefined {
    const fragments: string[] = [];

    const rootPem = input.loadedByRef.get(input.rootRef);
    if (rootPem) {
      fragments.push(rootPem.trim());
    }

    if (input.chainRef) {
      const chainPem = input.loadedByRef.get(input.chainRef);
      if (chainPem) {
        fragments.push(chainPem.trim());
      }
    } else if (input.trustBundleRef) {
      const candidate = input.materialRecords.find((record) => record.materialRef === input.trustBundleRef);
      if (candidate && candidate.kind === TrustMaterialKinds.certificateChainPem) {
        const bundlePem = input.loadedByRef.get(candidate.materialRef);
        if (bundlePem) {
          fragments.push(bundlePem.trim());
        }
      }
    }

    const unique = [...new Set(fragments.filter((fragment) => fragment.length > 0))];
    if (unique.length === 0) {
      return undefined;
    }
    return `${unique.join("\n")}\n`;
  }
}

function normalizeResolveInput(input: ResolveRuntimeTrustMaterialPackageInput): {
  readonly operationKey: string;
  readonly actorUserIdentityId: string;
  readonly targetKind: CertificateDistributionTargetKind;
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate: boolean;
  readonly includeCertificateChain: boolean;
  readonly includeTrustBundle: boolean;
  readonly includeProtectedReferences: boolean;
  readonly occurredAt: string;
} {
  const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
  const targetReferenceId = normalizeRequired(input.targetReferenceId, "targetReferenceId");
  assertTargetReferenceIdForKind(input.targetKind, targetReferenceId);

  const occurredAt = normalizeTimestamp(input.occurredAt) ?? new Date().toISOString();
  return Object.freeze({
    operationKey: normalizeRequired(input.operationKey, "operationKey"),
    actorUserIdentityId,
    targetKind: input.targetKind,
    targetReferenceId,
    workspaceId: normalizeOptional(input.workspaceId),
    certificateAuthorityId: normalizeOptional(input.certificateAuthorityId),
    serialNumber: normalizeSerial(input.serialNumber),
    includeLeafCertificate: input.includeLeafCertificate ?? true,
    includeCertificateChain: input.includeCertificateChain ?? true,
    includeTrustBundle: input.includeTrustBundle ?? true,
    includeProtectedReferences: input.includeProtectedReferences ?? false,
    occurredAt,
  });
}

function toTargetScope(
  targetKind: ResolveRuntimeTrustMaterialPackageInput["targetKind"],
  targetReferenceId: string,
  workspaceId?: string,
): {
  readonly kind: CertificateSubjectReferenceKind;
  readonly referenceId: string;
  readonly workspaceId?: string;
} {
  if (targetKind === "node") {
    return Object.freeze({
      kind: CertificateSubjectReferenceKinds.node,
      referenceId: targetReferenceId,
      workspaceId,
    });
  }
  if (targetKind === "device") {
    return Object.freeze({
      kind: CertificateSubjectReferenceKinds.device,
      referenceId: targetReferenceId,
      workspaceId,
    });
  }

  return Object.freeze({
    kind: CertificateSubjectReferenceKinds.service,
    referenceId: targetReferenceId,
    workspaceId,
  });
}

function isCertificateScopedToTarget(
  certificate: {
    readonly subjectReference: {
      readonly kind: CertificateSubjectReferenceKind;
      readonly referenceId: string;
      readonly workspaceId?: string;
    };
  },
  targetScope: {
    readonly kind: CertificateSubjectReferenceKind;
    readonly referenceId: string;
    readonly workspaceId?: string;
  },
): boolean {
  return certificate.subjectReference.kind === targetScope.kind
    && certificate.subjectReference.referenceId === targetScope.referenceId
    && certificate.subjectReference.workspaceId === targetScope.workspaceId;
}

function toPackageId(input: {
  readonly targetKind: string;
  readonly targetReferenceId: string;
  readonly certificateAuthorityId: string;
  readonly serialNumber?: string;
  readonly occurredAt: string;
}): string {
  return `runtime-trust-package:${input.targetKind}:${input.targetReferenceId}:${input.certificateAuthorityId}:${
    input.serialNumber ?? "none"
  }:${Date.parse(input.occurredAt)}`;
}

function normalizeRequired(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeSerial(value?: string): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[0-9A-F]{2,64}$/.test(normalized)) {
    throw new Error("serialNumber must be a hexadecimal string (2-64 chars).");
  }
  return normalized;
}

function normalizeTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const epoch = Date.parse(normalized);
  if (Number.isNaN(epoch)) {
    throw new Error("occurredAt must be a valid timestamp.");
  }
  return new Date(epoch).toISOString();
}

function redactAccessRef(accessRef: string): string {
  if (accessRef.startsWith("secret-store:")) {
    return redactSecretRef(accessRef);
  }
  const normalized = accessRef.trim();
  if (normalized.length <= 16) {
    return "[redacted]";
  }
  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
}

function assertTargetReferenceIdForKind(
  kind: ResolveRuntimeTrustMaterialPackageInput["targetKind"],
  referenceId: string,
): void {
  if (kind === "node" && !referenceId.startsWith("node:")) {
    throw new Error("node trust retrieval requires targetReferenceId to start with 'node:'.");
  }
  if (kind === "device" && !referenceId.startsWith("device:")) {
    throw new Error("device trust retrieval requires targetReferenceId to start with 'device:'.");
  }
  if (kind === "service" && !referenceId.startsWith("service:")) {
    throw new Error("service trust retrieval requires targetReferenceId to start with 'service:'.");
  }
  if (kind === "server" && !referenceId.startsWith("server:")) {
    throw new Error("server trust retrieval requires targetReferenceId to start with 'server:'.");
  }
}
