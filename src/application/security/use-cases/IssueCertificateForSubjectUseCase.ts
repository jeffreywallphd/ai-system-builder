import type { NodeIdentityPersistenceRecord } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
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
} from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateSubjectProfileKinds,
  evaluateCertificateIssuancePolicy,
  type CertificateSubjectProfileKind,
} from "../../../domain/security/CertificateIssuancePolicyDomain";
import { NodeApprovalStatuses, NodeRevocationStates, NodeTrustStates } from "../../../domain/nodes/NodeTrustDomain";
import type { INodeTrustIdentityPersistenceRepository } from "../../nodes/ports/INodeTrustIdentityPersistenceRepository";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityIssuerPort } from "../ports/ICertificateAuthorityIssuerPort";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";

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
  readonly issuer: ICertificateAuthorityIssuerPort;
  readonly nodeRepository?: INodeTrustIdentityPersistenceRepository;
}

export class IssueCertificateForSubjectUseCase {
  public constructor(private readonly dependencies: IssueCertificateForSubjectUseCaseDependencies) {}

  public async execute(input: IssueCertificateForSubjectUseCaseInput): Promise<IssueCertificateForSubjectUseCaseResult> {
    const normalized = normalizeInput(input);
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

    if (normalized.profileKind === CertificateSubjectProfileKinds.approvedNode) {
      await this.assertEligibleNodeSubject(normalized.subjectReference.referenceId);
    }

    const issued = await this.dependencies.issuer.issueCertificateMaterial({
      certificateAuthorityId: certificateAuthority.certificateAuthorityId,
      subject: normalized.subject,
      subjectReference: normalized.subjectReference,
      usages: normalized.usages,
      validityDays: normalized.validityDays,
      actorUserIdentityId: normalized.actorUserIdentityId,
      publicKeyPem: normalized.publicKeyPem,
      signatureAlgorithm: normalized.signatureAlgorithm,
    });

    const issuedCertificate = createIssuedCertificate({
      certificateAuthorityId: certificateAuthority.certificateAuthorityId,
      serialNumber: createCertificateSerialNumber(issued.serialNumber),
      subject: normalized.subject,
      subjectReference: normalized.subjectReference,
      usages: normalized.usages,
      validity: createCertificateValidityWindow({
        notBefore: issued.notBefore,
        notAfter: issued.notAfter,
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

    return Object.freeze({
      certificateAuthorityId: issued.certificateAuthorityId,
      profileKind: normalized.profileKind,
      serialNumber: issued.serialNumber,
      notBefore: issued.notBefore,
      notAfter: issued.notAfter,
      certificateMaterialRef: normalized.certificateMaterialRef,
      certificateChainMaterialRef: normalized.certificateChainMaterialRef,
      trustMaterialRef: normalized.trustMaterialRef,
      certificateFingerprintSha256: normalizeOptional(issued.certificateFingerprintSha256),
    });
  }

  private async assertEligibleNodeSubject(nodeId: string): Promise<void> {
    if (!this.dependencies.nodeRepository) {
      throw new Error("Node repository is required for approved-node certificate issuance.");
    }

    const node = await this.dependencies.nodeRepository.findNodeById(nodeId);
    if (!node) {
      throw new CertificateIssuancePolicyViolationError([
        `Node '${nodeId}' does not exist and cannot receive an issued certificate.`,
      ]);
    }

    const violations = evaluateNodeTrustPrerequisites(node);
    if (violations.length > 0) {
      throw new CertificateIssuancePolicyViolationError(violations);
    }
  }
}

function evaluateNodeTrustPrerequisites(node: NodeIdentityPersistenceRecord): ReadonlyArray<string> {
  const violations: string[] = [];
  if (node.approvalStatus !== NodeApprovalStatuses.approved) {
    violations.push(`Node '${node.nodeId}' must be approved before certificate issuance.`);
  }

  if (
    node.trustState !== NodeTrustStates.pendingApproval
    && node.trustState !== NodeTrustStates.trusted
  ) {
    violations.push(`Node '${node.nodeId}' must be in pending-approval or trusted state before certificate issuance.`);
  }

  if (
    node.trustState === NodeTrustStates.revoked
    || node.revocation.state === NodeRevocationStates.revoked
    || Boolean(node.revokedAt)
    || Boolean(node.revocation.revokedAt)
  ) {
    violations.push(`Node '${node.nodeId}' is revoked and cannot receive a certificate.`);
  }

  return Object.freeze(violations);
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
