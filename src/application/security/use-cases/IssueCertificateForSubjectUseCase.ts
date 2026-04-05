import { createHash } from "node:crypto";
import {
  normalizeCertificateAuthorityMutationOperationKey,
  type IssuedCertificatePersistenceRecord,
  type CertificateSubjectPersistenceRecord,
  type CertificateSubjectReferencePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import {
  CertificateAuthorityStatuses,
  createCertificateSerialNumber,
  createCertificateSubjectDescriptor,
  createCertificateValidityWindow,
  createIssuedCertificate,
  TrustMaterialKinds,
} from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateSubjectProfileKinds,
  evaluateCertificateIssuancePolicy,
  type CertificateSubjectProfileKind,
} from "../../../domain/security/CertificateIssuancePolicyDomain";
import type {
  ApprovedNodeCertificateEligibilityMetadata,
  INodeCertificateEligibilityPort,
} from "../ports/INodeCertificateEligibilityPort";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityRootMaterialStorage } from "../ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityIssuerPort } from "../ports/ICertificateAuthorityIssuerPort";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";

export class CertificateIssuancePolicyViolationError extends Error {
  public constructor(public readonly violations: ReadonlyArray<string>) {
    super(`Certificate issuance policy validation failed: ${violations.join("; ")}`);
    this.name = "CertificateIssuancePolicyViolationError";
  }
}

export interface IssueCertificateForSubjectUseCaseInput {
  readonly operationKey: string;
  readonly profileKind: CertificateSubjectProfileKind;
  readonly certificateAuthorityId?: string;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly subjectReference: CertificateSubjectReferencePersistenceRecord;
  readonly usages: ReadonlyArray<IssuedCertificatePersistenceRecord["usages"][number]>;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
  readonly publicKeyPem: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly signatureAlgorithm?: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly certificateMaterialSecretRef?: string;
  readonly certificateMaterialKeyScope?: string;
  readonly certificateChainMaterialSecretRef?: string;
  readonly certificateChainMaterialKeyScope?: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface IssueCertificateForSubjectUseCaseResult {
  readonly certificateAuthorityId: string;
  readonly profileKind: CertificateSubjectProfileKind;
  readonly serialNumber: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly certificateFingerprintSha256?: string;
}

export interface IssueCertificateForSubjectUseCaseDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly trustMaterialRepository: ITrustMaterialReferencePersistenceRepository;
  readonly certificateMaterialStorage: ICertificateAuthorityRootMaterialStorage;
  readonly issuer: ICertificateAuthorityIssuerPort;
  readonly nodeCertificateEligibilityPort?: INodeCertificateEligibilityPort;
  readonly auditHook?: (event: CertificateIssuanceAuditEvent) => Promise<void> | void;
}

export type CertificateIssuanceAuditEvent =
  | {
    readonly event: "certificate-issuance-started";
    readonly operationKey: string;
    readonly certificateAuthorityId?: string;
    readonly profileKind: CertificateSubjectProfileKind;
    readonly subjectReferenceKind: string;
    readonly subjectReferenceId: string;
    readonly actorUserIdentityId: string;
  }
  | {
    readonly event: "certificate-issuance-succeeded";
    readonly operationKey: string;
    readonly certificateAuthorityId: string;
    readonly serialNumber: string;
    readonly profileKind: CertificateSubjectProfileKind;
    readonly actorUserIdentityId: string;
    readonly certificateMaterialRefRedacted: string;
    readonly certificateChainMaterialRefRedacted?: string;
  }
  | {
    readonly event: "certificate-issuance-failed";
    readonly operationKey: string;
    readonly certificateAuthorityId?: string;
    readonly profileKind: CertificateSubjectProfileKind;
    readonly actorUserIdentityId: string;
    readonly code: string;
    readonly message: string;
    readonly compensatingRevocationAttempted: boolean;
  };

export class IssueCertificateForSubjectUseCase {
  public constructor(private readonly dependencies: IssueCertificateForSubjectUseCaseDependencies) {}

  public async execute(input: IssueCertificateForSubjectUseCaseInput): Promise<IssueCertificateForSubjectUseCaseResult> {
    const normalized = normalizeInput(input);
    await this.emitAudit({
      event: "certificate-issuance-started",
      operationKey: normalized.operationKey,
      certificateAuthorityId: normalized.certificateAuthorityId,
      profileKind: normalized.profileKind,
      subjectReferenceKind: normalized.subjectReference.kind,
      subjectReferenceId: normalized.subjectReference.referenceId,
      actorUserIdentityId: normalized.actorUserIdentityId,
    });

    let issued:
      | {
        readonly certificateAuthorityId: string;
        readonly serialNumber: string;
      }
      | undefined;
    let compensatingRevocationAttempted = false;

    try {
      const certificateAuthority = normalized.certificateAuthorityId
        ? await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(normalized.certificateAuthorityId)
        : await this.dependencies.certificateAuthorityRepository.findActiveCertificateAuthority(normalized.occurredAt);

      if (!certificateAuthority) {
        throw new Error("Active certificate authority is required for issuance.");
      }

      if (certificateAuthority.status !== CertificateAuthorityStatuses.active) {
        throw new Error(`Certificate authority '${certificateAuthority.certificateAuthorityId}' is not active.`);
      }
      if (
        Date.parse(certificateAuthority.validity.notBefore) > Date.parse(normalized.occurredAt)
        || Date.parse(certificateAuthority.validity.notAfter) <= Date.parse(normalized.occurredAt)
      ) {
        throw new Error(`Certificate authority '${certificateAuthority.certificateAuthorityId}' is outside its validity window.`);
      }

      const evaluation = evaluateCertificateIssuancePolicy({
        profileKind: normalized.profileKind,
        subject: createCertificateSubjectDescriptor(normalized.subject),
        subjectReference: normalized.subjectReference,
        usages: normalized.usages,
        validityDays: normalized.validityDays,
      });

      if (!evaluation.allowed) {
        throw new CertificateIssuancePolicyViolationError(evaluation.violations);
      }

      let nodeEligibilityMetadata: ApprovedNodeCertificateEligibilityMetadata | undefined;
      if (normalized.profileKind === CertificateSubjectProfileKinds.approvedNode) {
        nodeEligibilityMetadata = await this.assertEligibleNodeSubject(normalized.subjectReference.referenceId);
      }
      const resolvedSubjectReference = nodeEligibilityMetadata
        ? Object.freeze({
          ...normalized.subjectReference,
          referenceId: nodeEligibilityMetadata.nodeId,
        })
        : normalized.subjectReference;

      const issuedMaterial = await this.dependencies.issuer.issueCertificateMaterial({
        certificateAuthorityId: certificateAuthority.certificateAuthorityId,
        subject: normalized.subject,
        subjectReference: resolvedSubjectReference,
        usages: normalized.usages,
        validityDays: normalized.validityDays,
        actorUserIdentityId: normalized.actorUserIdentityId,
        publicKeyPem: normalized.publicKeyPem,
        signatureAlgorithm: normalized.signatureAlgorithm,
      });
      issued = Object.freeze({
        certificateAuthorityId: issuedMaterial.certificateAuthorityId,
        serialNumber: issuedMaterial.serialNumber,
      });

      await this.persistIssuedMaterials(certificateAuthority.certificateAuthorityId, normalized, issuedMaterial);

      const issuedCertificate = createIssuedCertificate({
        certificateAuthorityId: certificateAuthority.certificateAuthorityId,
        serialNumber: createCertificateSerialNumber(issuedMaterial.serialNumber),
        subject: normalized.subject,
        subjectReference: resolvedSubjectReference,
        usages: normalized.usages,
        validity: createCertificateValidityWindow({
          notBefore: issuedMaterial.notBefore,
          notAfter: issuedMaterial.notAfter,
        }),
        issuedAt: normalized.occurredAt,
        certificateMaterialRef: normalized.certificateMaterialRef,
        certificateChainMaterialRef: normalized.certificateChainMaterialRef,
        trustMaterialRef: normalized.trustMaterialRef,
        publicKeyAlgorithm: normalized.publicKeyAlgorithm,
        publicKeyFingerprintSha256: normalized.publicKeyFingerprintSha256,
        createdAt: normalized.occurredAt,
        updatedAt: normalized.occurredAt,
      });

      await this.dependencies.issuedCertificateRepository.saveIssuedCertificate({
        mutation: {
          operationKey: `${normalized.operationKey}:save-issued-certificate`,
          context: {
            actorUserIdentityId: normalized.actorUserIdentityId,
            occurredAt: normalized.occurredAt,
            reason: normalized.reason,
            correlationId: normalized.correlationId,
          },
        },
        record: Object.freeze({
          certificateAuthorityId: issuedCertificate.certificateAuthorityId,
          serialNumber: issuedCertificate.serialNumber.value,
          status: issuedCertificate.status,
          subject: issuedCertificate.subject,
          subjectReference: issuedCertificate.subjectReference,
          usages: issuedCertificate.usages,
          validity: issuedCertificate.validity,
          issuedAt: issuedCertificate.issuedAt,
          certificateMaterialRef: issuedCertificate.certificateMaterialRef,
          certificateChainMaterialRef: issuedCertificate.certificateChainMaterialRef,
          trustMaterialRef: issuedCertificate.trustMaterialRef,
          publicKeyAlgorithm: issuedCertificate.publicKeyAlgorithm,
          publicKeyFingerprintSha256: issuedCertificate.publicKeyFingerprintSha256,
          createdAt: issuedCertificate.createdAt,
          createdBy: normalized.actorUserIdentityId,
          lastModifiedAt: issuedCertificate.updatedAt,
          lastModifiedBy: normalized.actorUserIdentityId,
          revision: 0,
        }),
      });

      await this.emitAudit({
        event: "certificate-issuance-succeeded",
        operationKey: normalized.operationKey,
        certificateAuthorityId: issuedMaterial.certificateAuthorityId,
        serialNumber: issuedMaterial.serialNumber,
        profileKind: normalized.profileKind,
        actorUserIdentityId: normalized.actorUserIdentityId,
        certificateMaterialRefRedacted: redactReference(normalized.certificateMaterialRef),
        certificateChainMaterialRefRedacted: normalized.certificateChainMaterialRef
          ? redactReference(normalized.certificateChainMaterialRef)
          : undefined,
      });

      return Object.freeze({
        certificateAuthorityId: issuedMaterial.certificateAuthorityId,
        profileKind: normalized.profileKind,
        serialNumber: issuedMaterial.serialNumber,
        notBefore: issuedMaterial.notBefore,
        notAfter: issuedMaterial.notAfter,
        certificateMaterialRef: normalized.certificateMaterialRef,
        certificateChainMaterialRef: normalized.certificateChainMaterialRef,
        trustMaterialRef: normalized.trustMaterialRef,
        certificateFingerprintSha256: normalizeOptional(issuedMaterial.certificateFingerprintSha256),
      });
    } catch (error) {
      if (issued) {
        compensatingRevocationAttempted = await this.tryCompensatingRevocation(normalized, issued);
      }
      await this.emitAudit({
        event: "certificate-issuance-failed",
        operationKey: normalized.operationKey,
        certificateAuthorityId: issued?.certificateAuthorityId ?? normalized.certificateAuthorityId,
        profileKind: normalized.profileKind,
        actorUserIdentityId: normalized.actorUserIdentityId,
        code: toErrorCode(error),
        message: toErrorMessage(error),
        compensatingRevocationAttempted,
      });
      throw error;
    }
  }

  private async assertEligibleNodeSubject(nodeId: string): Promise<ApprovedNodeCertificateEligibilityMetadata> {
    if (!this.dependencies.nodeCertificateEligibilityPort) {
      throw new Error("Node certificate eligibility port is required for approved-node certificate issuance.");
    }

    const decision = await this.dependencies.nodeCertificateEligibilityPort.resolveApprovedNodeCertificateEligibility({
      nodeId,
    });

    if (!decision.eligible) {
      throw new CertificateIssuancePolicyViolationError(decision.violations);
    }

    return decision.metadata;
  }

  private async persistIssuedMaterials(
    certificateAuthorityId: string,
    input: ReturnType<typeof normalizeInput>,
    issued: {
      readonly certificatePem: string;
      readonly certificateChainPem: string;
      readonly certificateFingerprintSha256: string;
    },
  ): Promise<void> {
    const materials = [
      {
        materialRef: input.certificateMaterialRef,
        kind: TrustMaterialKinds.certificatePem,
        plaintextValue: issued.certificatePem,
        keyScope: input.certificateMaterialKeyScope,
        secretRef: input.certificateMaterialSecretRef,
      },
      ...(input.certificateChainMaterialRef
        ? [{
          materialRef: input.certificateChainMaterialRef,
          kind: TrustMaterialKinds.certificateChainPem,
          plaintextValue: issued.certificateChainPem,
          keyScope: input.certificateChainMaterialKeyScope,
          secretRef: input.certificateChainMaterialSecretRef,
        }]
        : []),
    ] as const;

    const persisted = await this.dependencies.certificateMaterialStorage.persistRootMaterials({
      certificateAuthorityId,
      actorUserIdentityId: input.actorUserIdentityId,
      reason: input.reason,
      materials,
    });

    const occurredAt = input.occurredAt;
    for (const persistedMaterial of persisted) {
      await this.dependencies.trustMaterialRepository.saveTrustMaterial({
        mutation: {
          operationKey: `${input.operationKey}:save-trust-material:${persistedMaterial.materialRef}`,
          context: {
            actorUserIdentityId: input.actorUserIdentityId,
            occurredAt,
            reason: input.reason,
            correlationId: input.correlationId,
          },
        },
        record: Object.freeze({
          materialRef: persistedMaterial.materialRef,
          kind: persistedMaterial.kind,
          storageLocator: persistedMaterial.secretRef,
          fingerprintSha256: persistedMaterial.materialRef === input.certificateMaterialRef
            ? normalizeOptional(issued.certificateFingerprintSha256)
            : createHash("sha256").update(issued.certificateChainPem).digest("hex"),
          createdAt: occurredAt,
          createdBy: input.actorUserIdentityId,
          lastModifiedAt: occurredAt,
          lastModifiedBy: input.actorUserIdentityId,
          revision: 0,
        }),
      });
    }
  }

  private async tryCompensatingRevocation(
    input: ReturnType<typeof normalizeInput>,
    issued: {
      readonly certificateAuthorityId: string;
      readonly serialNumber: string;
    },
  ): Promise<boolean> {
    try {
      await this.dependencies.issuer.revokeCertificateMaterial({
        certificateAuthorityId: issued.certificateAuthorityId,
        serialNumber: issued.serialNumber,
        reason: "unspecified",
        actorUserIdentityId: input.actorUserIdentityId,
        revokedAt: input.occurredAt,
      });
      return true;
    } catch {
      return true;
    }
  }

  private async emitAudit(event: CertificateIssuanceAuditEvent): Promise<void> {
    if (!this.dependencies.auditHook) {
      return;
    }

    try {
      await this.dependencies.auditHook(event);
    } catch {
      // Audit failures are intentionally non-fatal.
    }
  }
}

function normalizeInput(input: IssueCertificateForSubjectUseCaseInput): {
  readonly operationKey: string;
  readonly profileKind: CertificateSubjectProfileKind;
  readonly certificateAuthorityId?: string;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly subjectReference: CertificateSubjectReferencePersistenceRecord;
  readonly usages: ReadonlyArray<IssuedCertificatePersistenceRecord["usages"][number]>;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
  readonly publicKeyPem: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly signatureAlgorithm?: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly certificateMaterialSecretRef?: string;
  readonly certificateMaterialKeyScope?: string;
  readonly certificateChainMaterialSecretRef?: string;
  readonly certificateChainMaterialKeyScope?: string;
  readonly occurredAt: string;
  readonly reason?: string;
  readonly correlationId?: string;
} {
  const validityDays = input.validityDays;
  if (!Number.isInteger(validityDays) || validityDays < 1) {
    throw new Error("Certificate issuance validityDays must be an integer >= 1.");
  }

  const occurredAt = normalizeTimestamp(input.occurredAt);

  return Object.freeze({
    operationKey: normalizeCertificateAuthorityMutationOperationKey(input.operationKey),
    profileKind: input.profileKind,
    certificateAuthorityId: normalizeOptional(input.certificateAuthorityId),
    subject: input.subject,
    subjectReference: Object.freeze({
      kind: input.subjectReference.kind,
      referenceId: normalizeRequired(input.subjectReference.referenceId, "subjectReference.referenceId"),
      workspaceId: normalizeOptional(input.subjectReference.workspaceId),
    }),
    usages: Object.freeze([...new Set(input.usages)]),
    validityDays,
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId"),
    publicKeyPem: normalizeRequired(input.publicKeyPem, "publicKeyPem"),
    publicKeyAlgorithm: normalizeRequired(input.publicKeyAlgorithm, "publicKeyAlgorithm"),
    publicKeyFingerprintSha256: normalizeOptional(input.publicKeyFingerprintSha256),
    signatureAlgorithm: normalizeOptional(input.signatureAlgorithm),
    certificateMaterialRef: normalizeRequired(input.certificateMaterialRef, "certificateMaterialRef"),
    certificateChainMaterialRef: normalizeOptional(input.certificateChainMaterialRef),
    trustMaterialRef: normalizeOptional(input.trustMaterialRef),
    certificateMaterialSecretRef: normalizeOptional(input.certificateMaterialSecretRef),
    certificateMaterialKeyScope: normalizeOptional(input.certificateMaterialKeyScope),
    certificateChainMaterialSecretRef: normalizeOptional(input.certificateChainMaterialSecretRef),
    certificateChainMaterialKeyScope: normalizeOptional(input.certificateChainMaterialKeyScope),
    occurredAt,
    reason: normalizeOptional(input.reason),
    correlationId: normalizeOptional(input.correlationId),
  });
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt must be a valid timestamp when provided.");
  }

  return parsed.toISOString();
}

function redactReference(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 14) {
    return "[redacted]";
  }
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "certificate issuance failed";
}

function toErrorCode(error: unknown): string {
  if (error instanceof CertificateIssuancePolicyViolationError) {
    return "certificate-issuance-policy-violation";
  }
  return "certificate-issuance-failed";
}
