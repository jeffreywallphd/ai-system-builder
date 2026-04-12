import type { SecretServiceResult } from "../use-cases/SecretManagementServiceContracts";

export interface ResolvedSecurityMaterialCredential {
  readonly secretId: string;
  readonly currentVersionId: string;
  readonly credential: string;
}

export interface ResolveServerProviderCredentialMaterialInput {
  readonly providerId: string;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveServerSigningMaterialInput {
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly signingPurpose: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveWorkspaceProviderCredentialMaterialInput {
  readonly workspaceId: string;
  readonly providerId: string;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveUserProviderCredentialMaterialInput {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly providerId: string;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface IRuntimeSecurityMaterialResolverPort {
  resolveServerProviderCredential(
    input: ResolveServerProviderCredentialMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>>;
  resolveIdentitySessionSigningMaterial(
    input: ResolveServerSigningMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>>;
  resolveWorkspaceProviderCredential(
    input: ResolveWorkspaceProviderCredentialMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>>;
  resolveUserProviderCredential(
    input: ResolveUserProviderCredentialMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>>;
}

export interface ManagedServerTlsRuntimeMaterial {
  readonly certPem: string;
  readonly keyPem: string;
  readonly caPem?: string;
}

export interface ResolveManagedServerTlsRuntimeMaterialInput {
  readonly targetReferenceId: string;
  readonly actorUserIdentityId: string;
  readonly privateKeyMaterialRef: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
}

export interface IManagedServerTlsRuntimeMaterialResolverPort {
  resolveManagedServerTlsRuntimeMaterial(
    input: ResolveManagedServerTlsRuntimeMaterialInput,
  ): Promise<ManagedServerTlsRuntimeMaterial>;
}
