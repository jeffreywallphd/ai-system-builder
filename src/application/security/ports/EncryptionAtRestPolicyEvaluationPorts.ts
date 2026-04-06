import type { EncryptionAtRestPolicyDefinition } from "../../../domain/security/EncryptionAtRestPolicyDomain";

export interface ResolveEncryptionAtRestPolicyContextRequest {
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
}

export interface ResolvedEncryptionAtRestPolicyContext {
  readonly platformPolicy: EncryptionAtRestPolicyDefinition;
  readonly workspacePolicy?: EncryptionAtRestPolicyDefinition;
  readonly storageInstancePolicy?: EncryptionAtRestPolicyDefinition;
}

export interface IEncryptionAtRestPolicyContextResolverPort {
  resolvePolicyContext(
    request: ResolveEncryptionAtRestPolicyContextRequest,
  ): Promise<ResolvedEncryptionAtRestPolicyContext>;
}
