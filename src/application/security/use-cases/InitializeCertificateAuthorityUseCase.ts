import { CertificateAuthorityStatuses, createCertificateAuthorityRoot } from "@domain/security/CertificateAuthorityDomain";
import type { ICertificateAuthorityIssuerPort } from "../ports/ICertificateAuthorityIssuerPort";
import type { ICertificateAuthorityRootMaterialStorage } from "../ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import {
  CertificateLifecycleAuditEventTypes,
  publishCertificateLifecycleAuditEventBestEffort,
  type CertificateLifecycleAuditSink,
} from "../ports/CertificateLifecycleAuditPorts";
import {
  normalizeCertificateAuthorityMutationOperationKey,
  type CertificateAuthorityRootPersistenceRecord,
  type CertificateSubjectPersistenceRecord,
  type RotationPolicyMetadataPersistenceRecord,
} from "@shared/dto/security/CertificateAuthorityDtos";

export const CertificateAuthorityInitializationConflictPolicies = Object.freeze({
  reject: "reject",
  returnExisting: "return-existing",
});

export type CertificateAuthorityInitializationConflictPolicy =
  typeof CertificateAuthorityInitializationConflictPolicies[keyof typeof CertificateAuthorityInitializationConflictPolicies];

export interface InitializeCertificateAuthorityUseCaseInput {
  readonly operationKey: string;
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly signatureAlgorithm: string;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rootCertificateSecretRef?: string;
  readonly rootPrivateKeySecretRef?: string;
  readonly rootCertificateKeyScope?: string;
  readonly rootPrivateKeyKeyScope?: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly conflictPolicy?: CertificateAuthorityInitializationConflictPolicy;
  readonly rotationPolicy?: Partial<RotationPolicyMetadataPersistenceRecord>;
}

export const CertificateAuthorityInitializationOutcomes = Object.freeze({
  initialized: "initialized",
  alreadyInitialized: "already-initialized",
});

export type CertificateAuthorityInitializationOutcome =
  typeof CertificateAuthorityInitializationOutcomes[keyof typeof CertificateAuthorityInitializationOutcomes];

export interface InitializeCertificateAuthorityUseCaseResult {
  readonly outcome: CertificateAuthorityInitializationOutcome;
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rootCertificateSecretRef: string;
  readonly rootPrivateKeySecretRef: string;
  readonly rootCertificateFingerprintSha256?: string;
}

export type CertificateAuthorityInitializationAuditEvent =
  | {
    readonly event: "ca-initialize-started";
    readonly certificateAuthorityId: string;
    readonly operationKey: string;
    readonly actorUserIdentityId: string;
  }
  | {
    readonly event: "ca-initialize-succeeded";
    readonly certificateAuthorityId: string;
    readonly operationKey: string;
    readonly actorUserIdentityId: string;
    readonly outcome: CertificateAuthorityInitializationOutcome;
    readonly rootCertificateMaterialRef: string;
    readonly rootPrivateKeyMaterialRef: string;
    readonly rootCertificateSecretRefRedacted: string;
    readonly rootPrivateKeySecretRefRedacted: string;
  }
  | {
    readonly event: "ca-initialize-failed";
    readonly certificateAuthorityId: string;
    readonly operationKey: string;
    readonly actorUserIdentityId: string;
    readonly code: string;
    readonly message: string;
  };

export class CertificateAuthorityInitializationConflictError extends Error {
  public constructor(message: string, public readonly existingCertificateAuthorityId: string) {
    super(message);
    this.name = "CertificateAuthorityInitializationConflictError";
  }
}

export class CertificateAuthorityInitializationMigrationRequiredError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CertificateAuthorityInitializationMigrationRequiredError";
  }
}

export interface InitializeCertificateAuthorityUseCaseDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly trustMaterialRepository: ITrustMaterialReferencePersistenceRepository;
  readonly rootMaterialStorage: ICertificateAuthorityRootMaterialStorage;
  readonly issuer: ICertificateAuthorityIssuerPort;
  readonly auditSink?: CertificateLifecycleAuditSink;
  readonly auditHook?: (event: CertificateAuthorityInitializationAuditEvent) => Promise<void> | void;
}

export class InitializeCertificateAuthorityUseCase {
  public constructor(private readonly dependencies: InitializeCertificateAuthorityUseCaseDependencies) {}

  public async execute(input: InitializeCertificateAuthorityUseCaseInput): Promise<InitializeCertificateAuthorityUseCaseResult> {
    const normalized = normalizeInput(input);
      await this.emitAudit({
        event: "ca-initialize-started",
        occurredAt: normalized.occurredAt,
        certificateAuthorityId: normalized.certificateAuthorityId,
        operationKey: normalized.operationKey,
        actorUserIdentityId: normalized.actorUserIdentityId,
      });

    try {
      const existingAuthorities = await this.dependencies.certificateAuthorityRepository.listCertificateAuthorities({
        includeRetired: true,
        includeCompromised: true,
        limit: 20,
      });
      const activeAuthority = existingAuthorities.find((authority) => authority.status === CertificateAuthorityStatuses.active);

      if (activeAuthority) {
        if (normalized.conflictPolicy === CertificateAuthorityInitializationConflictPolicies.returnExisting) {
          const existingResult = await this.toExistingResult(activeAuthority);
          await this.emitAudit({
            event: "ca-initialize-succeeded",
            occurredAt: normalized.occurredAt,
            certificateAuthorityId: existingResult.certificateAuthorityId,
            operationKey: normalized.operationKey,
            actorUserIdentityId: normalized.actorUserIdentityId,
            outcome: CertificateAuthorityInitializationOutcomes.alreadyInitialized,
            rootCertificateMaterialRef: existingResult.rootCertificateMaterialRef,
            rootPrivateKeyMaterialRef: existingResult.rootPrivateKeyMaterialRef,
            rootCertificateSecretRefRedacted: redactSecretRef(existingResult.rootCertificateSecretRef),
            rootPrivateKeySecretRefRedacted: redactSecretRef(existingResult.rootPrivateKeySecretRef),
          });
          return existingResult;
        }

        throw new CertificateAuthorityInitializationConflictError(
          `Active certificate authority '${activeAuthority.certificateAuthorityId}' already exists.`,
          activeAuthority.certificateAuthorityId,
        );
      }

      if (existingAuthorities.length > 0) {
        throw new CertificateAuthorityInitializationMigrationRequiredError(
          "Certificate authority metadata exists in a non-active state. Run migration/recovery flow before initialization.",
        );
      }

      const generated = await this.dependencies.issuer.initializeInternalCertificateAuthority({
        certificateAuthorityId: normalized.certificateAuthorityId,
        displayName: normalized.displayName,
        subject: normalized.subject,
        signatureAlgorithm: normalized.signatureAlgorithm,
        validityDays: normalized.validityDays,
        actorUserIdentityId: normalized.actorUserIdentityId,
      });

      const persistedMaterials = await this.dependencies.rootMaterialStorage.persistRootMaterials({
        certificateAuthorityId: normalized.certificateAuthorityId,
        actorUserIdentityId: normalized.actorUserIdentityId,
        reason: normalized.reason,
        materials: [
          {
            materialRef: normalized.rootCertificateMaterialRef,
            kind: "certificate-pem",
            plaintextValue: generated.rootCertificatePem,
            keyScope: normalized.rootCertificateKeyScope,
            secretRef: normalized.rootCertificateSecretRef,
          },
          {
            materialRef: normalized.rootPrivateKeyMaterialRef,
            kind: "private-key-encrypted-pem",
            plaintextValue: generated.encryptedRootPrivateKeyPem,
            keyScope: normalized.rootPrivateKeyKeyScope,
            secretRef: normalized.rootPrivateKeySecretRef,
          },
        ],
      });

      const rootCertificateMaterial = findPersistedMaterial(persistedMaterials, normalized.rootCertificateMaterialRef);
      const rootPrivateKeyMaterial = findPersistedMaterial(persistedMaterials, normalized.rootPrivateKeyMaterialRef);

      const createdAt = normalized.occurredAt ?? new Date().toISOString();
      const rotationPolicy = resolveRotationPolicy(normalized.rotationPolicy);
      const rootRecord = createCertificateAuthorityRoot({
        certificateAuthorityId: normalized.certificateAuthorityId,
        displayName: normalized.displayName,
        status: CertificateAuthorityStatuses.active,
        subject: normalized.subject,
        serialNumber: { value: generated.serialNumber },
        validity: {
          notBefore: generated.notBefore,
          notAfter: generated.notAfter,
        },
        signatureAlgorithm: normalized.signatureAlgorithm,
        rootCertificateMaterialRef: normalized.rootCertificateMaterialRef,
        rootPrivateKeyMaterialRef: normalized.rootPrivateKeyMaterialRef,
        rotationPolicy,
        createdAt,
        updatedAt: createdAt,
      });

      await this.dependencies.trustMaterialRepository.saveTrustMaterial({
        mutation: toMutation(normalized.operationKey, "trust-material-root-certificate", normalized),
        record: Object.freeze({
          materialRef: normalized.rootCertificateMaterialRef,
          kind: "certificate-pem",
          storageLocator: rootCertificateMaterial.secretRef,
          fingerprintSha256: normalizeOptional(generated.rootCertificateFingerprintSha256),
          createdAt,
          createdBy: normalized.actorUserIdentityId,
          lastModifiedAt: createdAt,
          lastModifiedBy: normalized.actorUserIdentityId,
          revision: 0,
        }),
      });

      await this.dependencies.trustMaterialRepository.saveTrustMaterial({
        mutation: toMutation(normalized.operationKey, "trust-material-root-private-key", normalized),
        record: Object.freeze({
          materialRef: normalized.rootPrivateKeyMaterialRef,
          kind: "private-key-encrypted-pem",
          storageLocator: rootPrivateKeyMaterial.secretRef,
          createdAt,
          createdBy: normalized.actorUserIdentityId,
          lastModifiedAt: createdAt,
          lastModifiedBy: normalized.actorUserIdentityId,
          revision: 0,
        }),
      });

      await this.dependencies.certificateAuthorityRepository.saveCertificateAuthority({
        mutation: toMutation(normalized.operationKey, "save-certificate-authority", normalized),
        record: Object.freeze({
          certificateAuthorityId: rootRecord.certificateAuthorityId,
          displayName: rootRecord.displayName,
          status: rootRecord.status,
          subject: rootRecord.subject,
          serialNumber: rootRecord.serialNumber.value,
          validity: rootRecord.validity,
          signatureAlgorithm: rootRecord.signatureAlgorithm,
          rootCertificateMaterialRef: rootRecord.rootCertificateMaterialRef,
          rootPrivateKeyMaterialRef: rootRecord.rootPrivateKeyMaterialRef,
          rotationPolicy: rootRecord.rotationPolicy,
          rotatedFromCertificateAuthorityId: rootRecord.rotatedFromCertificateAuthorityId,
          retiredAt: rootRecord.retiredAt,
          compromisedAt: rootRecord.compromisedAt,
          createdAt,
          createdBy: normalized.actorUserIdentityId,
          lastModifiedAt: createdAt,
          lastModifiedBy: normalized.actorUserIdentityId,
          revision: 0,
        }),
      });

      const result: InitializeCertificateAuthorityUseCaseResult = Object.freeze({
        outcome: CertificateAuthorityInitializationOutcomes.initialized,
        certificateAuthorityId: rootRecord.certificateAuthorityId,
        serialNumber: rootRecord.serialNumber.value,
        notBefore: rootRecord.validity.notBefore,
        notAfter: rootRecord.validity.notAfter,
        rootCertificateMaterialRef: rootRecord.rootCertificateMaterialRef,
        rootPrivateKeyMaterialRef: rootRecord.rootPrivateKeyMaterialRef,
        rootCertificateSecretRef: rootCertificateMaterial.secretRef,
        rootPrivateKeySecretRef: rootPrivateKeyMaterial.secretRef,
        rootCertificateFingerprintSha256: normalizeOptional(generated.rootCertificateFingerprintSha256),
      });

      await this.emitAudit({
        event: "ca-initialize-succeeded",
        occurredAt: normalized.occurredAt,
        certificateAuthorityId: result.certificateAuthorityId,
        operationKey: normalized.operationKey,
        actorUserIdentityId: normalized.actorUserIdentityId,
        outcome: result.outcome,
        rootCertificateMaterialRef: result.rootCertificateMaterialRef,
        rootPrivateKeyMaterialRef: result.rootPrivateKeyMaterialRef,
        rootCertificateSecretRefRedacted: redactSecretRef(result.rootCertificateSecretRef),
        rootPrivateKeySecretRefRedacted: redactSecretRef(result.rootPrivateKeySecretRef),
      });

      return result;
    } catch (error) {
      await this.emitAudit({
        event: "ca-initialize-failed",
        occurredAt: normalized.occurredAt,
        certificateAuthorityId: normalized.certificateAuthorityId,
        operationKey: normalized.operationKey,
        actorUserIdentityId: normalized.actorUserIdentityId,
        code: toErrorCode(error),
        message: toErrorMessage(error),
      });
      throw error;
    }
  }

  private async toExistingResult(
    authority: CertificateAuthorityRootPersistenceRecord,
  ): Promise<InitializeCertificateAuthorityUseCaseResult> {
    const rootCertificateMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      authority.rootCertificateMaterialRef,
    );
    const rootPrivateKeyMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      authority.rootPrivateKeyMaterialRef,
    );

    if (!rootCertificateMaterial || !rootPrivateKeyMaterial) {
      throw new CertificateAuthorityInitializationMigrationRequiredError(
        `Persisted trust material metadata for active certificate authority '${authority.certificateAuthorityId}' is incomplete.`,
      );
    }

    return Object.freeze({
      outcome: CertificateAuthorityInitializationOutcomes.alreadyInitialized,
      certificateAuthorityId: authority.certificateAuthorityId,
      serialNumber: authority.serialNumber,
      notBefore: authority.validity.notBefore,
      notAfter: authority.validity.notAfter,
      rootCertificateMaterialRef: authority.rootCertificateMaterialRef,
      rootPrivateKeyMaterialRef: authority.rootPrivateKeyMaterialRef,
      rootCertificateSecretRef: rootCertificateMaterial.storageLocator,
      rootPrivateKeySecretRef: rootPrivateKeyMaterial.storageLocator,
      rootCertificateFingerprintSha256: rootCertificateMaterial.fingerprintSha256,
    });
  }

  private async emitAudit(
    event: CertificateAuthorityInitializationAuditEvent & { readonly occurredAt?: string },
  ): Promise<void> {
    if (this.dependencies.auditHook) {
      try {
        await this.dependencies.auditHook(event);
      } catch {
        // Audit hook failures are intentionally non-fatal to avoid blocking initialization lifecycle.
      }
    }

    await publishCertificateLifecycleAuditEventBestEffort(this.dependencies.auditSink, {
      type: event.event,
      actorUserIdentityId: event.actorUserIdentityId,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      certificateAuthorityId: event.certificateAuthorityId,
      details: toCertificateLifecycleAuditDetails(event),
    });
  }
}

function normalizeInput(input: InitializeCertificateAuthorityUseCaseInput): {
  readonly operationKey: string;
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly signatureAlgorithm: string;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rootCertificateSecretRef?: string;
  readonly rootPrivateKeySecretRef?: string;
  readonly rootCertificateKeyScope?: string;
  readonly rootPrivateKeyKeyScope?: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly conflictPolicy: CertificateAuthorityInitializationConflictPolicy;
  readonly rotationPolicy?: Partial<RotationPolicyMetadataPersistenceRecord>;
} {
  const validityDays = input.validityDays;
  if (!Number.isInteger(validityDays) || validityDays < 1) {
    throw new Error("Certificate authority validityDays must be an integer >= 1.");
  }

  return Object.freeze({
    operationKey: normalizeCertificateAuthorityMutationOperationKey(input.operationKey),
    certificateAuthorityId: normalizeRequired(input.certificateAuthorityId, "Certificate authority id"),
    displayName: normalizeRequired(input.displayName, "Certificate authority displayName"),
    subject: input.subject,
    signatureAlgorithm: normalizeRequired(input.signatureAlgorithm, "Certificate authority signatureAlgorithm"),
    validityDays,
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "Certificate authority actorUserIdentityId"),
    rootCertificateMaterialRef: normalizeRequired(
      input.rootCertificateMaterialRef,
      "Certificate authority rootCertificateMaterialRef",
    ),
    rootPrivateKeyMaterialRef: normalizeRequired(
      input.rootPrivateKeyMaterialRef,
      "Certificate authority rootPrivateKeyMaterialRef",
    ),
    rootCertificateSecretRef: normalizeOptional(input.rootCertificateSecretRef),
    rootPrivateKeySecretRef: normalizeOptional(input.rootPrivateKeySecretRef),
    rootCertificateKeyScope: normalizeOptional(input.rootCertificateKeyScope),
    rootPrivateKeyKeyScope: normalizeOptional(input.rootPrivateKeyKeyScope),
    occurredAt: normalizeOptional(input.occurredAt),
    reason: normalizeOptional(input.reason),
    correlationId: normalizeOptional(input.correlationId),
    conflictPolicy: input.conflictPolicy ?? CertificateAuthorityInitializationConflictPolicies.reject,
    rotationPolicy: input.rotationPolicy,
  });
}

function resolveRotationPolicy(
  candidate?: Partial<RotationPolicyMetadataPersistenceRecord>,
): RotationPolicyMetadataPersistenceRecord {
  return Object.freeze({
    profileId: normalizeRequired(candidate?.profileId ?? "rotation:default", "Certificate authority rotation profileId"),
    autoRotateEnabled: candidate?.autoRotateEnabled ?? true,
    rotateBeforeExpiryDays: candidate?.rotateBeforeExpiryDays ?? 90,
    overlapDays: candidate?.overlapDays ?? 30,
    maxLifetimeDays: candidate?.maxLifetimeDays ?? 3650,
    lastRotatedAt: normalizeOptional(candidate?.lastRotatedAt),
    nextRotationDueAt: normalizeOptional(candidate?.nextRotationDueAt),
  });
}

function toMutation(
  operationKey: string,
  operationSuffix: string,
  input: {
    readonly actorUserIdentityId: string;
    readonly occurredAt?: string;
    readonly reason?: string;
    readonly correlationId?: string;
  },
): {
  readonly operationKey: string;
  readonly context: {
    readonly actorUserIdentityId: string;
    readonly occurredAt?: string;
    readonly reason?: string;
    readonly correlationId?: string;
  };
} {
  return Object.freeze({
    operationKey: `${operationKey}:${operationSuffix}`,
    context: Object.freeze({
      actorUserIdentityId: input.actorUserIdentityId,
      occurredAt: input.occurredAt,
      reason: input.reason,
      correlationId: input.correlationId,
    }),
  });
}

function findPersistedMaterial(
  materials: ReadonlyArray<{
    readonly materialRef: string;
    readonly secretRef: string;
  }>,
  materialRef: string,
): {
  readonly materialRef: string;
  readonly secretRef: string;
} {
  const material = materials.find((candidate) => candidate.materialRef === materialRef);
  if (!material) {
    throw new Error(`Persisted root material '${materialRef}' is missing from storage output.`);
  }
  return material;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "unknown initialization failure";
}

function toErrorCode(error: unknown): string {
  if (error instanceof CertificateAuthorityInitializationConflictError) {
    return "ca-initialize-conflict";
  }
  if (error instanceof CertificateAuthorityInitializationMigrationRequiredError) {
    return "ca-initialize-migration-required";
  }
  return "ca-initialize-failed";
}

function redactSecretRef(secretRef: string): string {
  const normalized = secretRef.trim();
  if (normalized.length <= 16) {
    return "[redacted]";
  }
  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
}

function toCertificateLifecycleAuditDetails(
  event: CertificateAuthorityInitializationAuditEvent,
): Readonly<Record<string, unknown>> {
  switch (event.event) {
    case CertificateLifecycleAuditEventTypes.certificateAuthorityInitializationStarted:
      return Object.freeze({
        operationKey: event.operationKey,
      });
    case CertificateLifecycleAuditEventTypes.certificateAuthorityInitializationSucceeded:
      return Object.freeze({
        operationKey: event.operationKey,
        outcome: event.outcome,
        rootCertificateMaterialRef: event.rootCertificateMaterialRef,
        rootPrivateKeyMaterialRef: event.rootPrivateKeyMaterialRef,
        rootCertificateSecretRef: event.rootCertificateSecretRefRedacted,
        rootPrivateKeySecretRef: event.rootPrivateKeySecretRefRedacted,
      });
    case CertificateLifecycleAuditEventTypes.certificateAuthorityInitializationFailed:
      return Object.freeze({
        operationKey: event.operationKey,
        code: event.code,
        message: event.message,
      });
    default:
      return Object.freeze({});
  }
}

