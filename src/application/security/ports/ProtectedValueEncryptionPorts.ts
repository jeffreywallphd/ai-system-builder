import type {
  EncryptionKeyScope,
  ProtectedDataClass,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import type { EncryptionKeyDescriptor } from "./EncryptionKeyResolutionPorts";

export const ProtectedValuePayloadDescriptorVersions = Object.freeze({
  v1: "protected-value-payload/v1",
});

export type ProtectedValuePayloadDescriptorVersion =
  typeof ProtectedValuePayloadDescriptorVersions[keyof typeof ProtectedValuePayloadDescriptorVersions];

export interface ProtectedValuePayloadDescriptor {
  readonly descriptorVersion: ProtectedValuePayloadDescriptorVersion;
  readonly algorithm: string;
  readonly keyReferenceId: string;
  readonly keyId: string;
  readonly keyVersion?: string;
  readonly keyScope: EncryptionKeyScope;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly dataClass?: ProtectedDataClass;
  readonly encryptedAt: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ProtectedValuePayload {
  readonly descriptor: ProtectedValuePayloadDescriptor;
  readonly payloadBase64: string;
}

export interface EncryptionKeyMaterialDescriptor {
  readonly keyReferenceId: string;
  readonly algorithm: string;
  readonly keyBytes: Uint8Array;
}

export interface ResolveEncryptionKeyMaterialRequest {
  readonly keyReferenceId: string;
}

export interface IEncryptionKeyMaterialPort {
  resolveKeyMaterialByReference(
    request: ResolveEncryptionKeyMaterialRequest,
  ): Promise<EncryptionKeyMaterialDescriptor | undefined>;
}

export const ProtectedValueEncryptionErrorCodes = Object.freeze({
  invalidRequest: "protected-value-encryption-invalid-request",
  keyUnavailable: "protected-value-encryption-key-unavailable",
  unsupportedAlgorithm: "protected-value-encryption-unsupported-algorithm",
  malformedPayload: "protected-value-encryption-malformed-payload",
  authenticationFailed: "protected-value-encryption-authentication-failed",
  encryptionFailed: "protected-value-encryption-failed",
  decryptionFailed: "protected-value-decryption-failed",
  internal: "protected-value-encryption-internal",
});

export type ProtectedValueEncryptionErrorCode =
  typeof ProtectedValueEncryptionErrorCodes[keyof typeof ProtectedValueEncryptionErrorCodes];

export interface ProtectedValueEncryptionError {
  readonly code: ProtectedValueEncryptionErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ProtectedValueEncryptionPortResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ProtectedValueEncryptionError;
  };

export interface EncryptProtectedValueRequest {
  readonly plaintext: Uint8Array;
  readonly aad: string;
  readonly key: EncryptionKeyDescriptor;
  readonly dataClass?: ProtectedDataClass;
  readonly encryptedAt?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface DecryptProtectedValueRequest {
  readonly encryptedPayload: ProtectedValuePayload;
  readonly aad: string;
  readonly expectedKeyReferenceId?: string;
  readonly expectedKeyScope?: EncryptionKeyScope;
}

export interface DecryptedProtectedValue {
  readonly plaintext: Uint8Array;
  readonly descriptor: ProtectedValuePayloadDescriptor;
}

export interface IProtectedValueEncryptionPort {
  encrypt(
    request: EncryptProtectedValueRequest,
  ): Promise<ProtectedValueEncryptionPortResult<ProtectedValuePayload>>;
  decrypt(
    request: DecryptProtectedValueRequest,
  ): Promise<ProtectedValueEncryptionPortResult<DecryptedProtectedValue>>;
}

