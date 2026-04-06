import type {
  EncryptionKeyScope,
  EncryptionPolicyEvaluationSource,
  ProtectedDataClass,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type { EncryptionKeyDescriptor, EncryptionKeyScopeOwner } from "../ports/EncryptionKeyResolutionPorts";

export const EncryptionMaterialClasses = Object.freeze({
  secretMaterial: "secret-material",
  signingMaterial: "signing-material",
  secretMetadata: "secret-metadata",
  sensitiveMetadata: "sensitive-metadata",
  assetContent: "asset-content",
});

export type EncryptionMaterialClass = typeof EncryptionMaterialClasses[keyof typeof EncryptionMaterialClasses];

export const EncryptionKeyResolutionErrorCodes = Object.freeze({
  invalidRequest: "encryption-key-resolution-invalid-request",
  policyViolation: "encryption-key-resolution-policy-violation",
  resolutionFailed: "encryption-key-resolution-failed",
  keyUnavailable: "encryption-key-resolution-key-unavailable",
  notFound: "encryption-key-resolution-not-found",
  internal: "encryption-key-resolution-internal",
});

export type EncryptionKeyResolutionErrorCode =
  typeof EncryptionKeyResolutionErrorCodes[keyof typeof EncryptionKeyResolutionErrorCodes];

export interface EncryptionKeyResolutionError {
  readonly code: EncryptionKeyResolutionErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type EncryptionKeyResolutionServiceResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: EncryptionKeyResolutionError;
  };

export interface ResolveEncryptionKeyForMaterialRequest {
  readonly materialClass: EncryptionMaterialClass;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
}

export interface ResolvedEncryptionKeyForMaterial {
  readonly materialClass: EncryptionMaterialClass;
  readonly policyDataClass: ProtectedDataClass;
  readonly keyScope: EncryptionKeyScope;
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly key: EncryptionKeyDescriptor;
  readonly policyResolvedFrom: EncryptionPolicyEvaluationSource;
}

export interface ResolveStoredEncryptionKeyReferenceRequest {
  readonly keyReferenceId: string;
}

export interface ResolveStoredEncryptionKeyReference {
  readonly key: EncryptionKeyDescriptor;
}

export interface EncryptionKeyResolutionUseCaseContracts {
  resolveKeyForMaterial(
    request: ResolveEncryptionKeyForMaterialRequest,
  ): Promise<EncryptionKeyResolutionServiceResult<ResolvedEncryptionKeyForMaterial>>;
  resolveStoredKeyReference(
    request: ResolveStoredEncryptionKeyReferenceRequest,
  ): Promise<EncryptionKeyResolutionServiceResult<ResolveStoredEncryptionKeyReference>>;
}

export interface IEncryptionKeyResolutionService extends EncryptionKeyResolutionUseCaseContracts {}

