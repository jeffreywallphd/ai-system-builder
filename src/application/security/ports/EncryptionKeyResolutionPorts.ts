import type { EncryptionKeyScope } from "../../../domain/security/EncryptionAtRestPolicyDomain";

export const EncryptionKeyLifecycleStates = Object.freeze({
  active: "active",
  retiring: "retiring",
  retired: "retired",
});

export type EncryptionKeyLifecycleState =
  typeof EncryptionKeyLifecycleStates[keyof typeof EncryptionKeyLifecycleStates];

export interface EncryptionKeyScopeOwner {
  readonly scope: EncryptionKeyScope;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
}

export interface EncryptionKeyDescriptor {
  readonly keyReferenceId: string;
  readonly keyId: string;
  readonly keyVersion?: string;
  readonly algorithm: string;
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly lifecycleState: EncryptionKeyLifecycleState;
  readonly activatedAt: string;
  readonly rotatesAfter?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ResolveActiveEncryptionKeyRequest {
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly occurredAt?: string;
}

export interface ResolveEncryptionKeyByReferenceRequest {
  readonly keyReferenceId: string;
}

export interface IEncryptionKeyCatalogPort {
  resolveActiveKeyForScope(
    request: ResolveActiveEncryptionKeyRequest,
  ): Promise<EncryptionKeyDescriptor | undefined>;
  resolveKeyByReference(
    request: ResolveEncryptionKeyByReferenceRequest,
  ): Promise<EncryptionKeyDescriptor | undefined>;
}

