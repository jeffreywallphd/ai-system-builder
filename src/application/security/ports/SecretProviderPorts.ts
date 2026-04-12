import type { SecretKind, SecretReference, SecretReferenceMetadata, SecretScopeOwner } from "@domain/security/SecretDomain";
import type { SecretServiceResult } from "../use-cases/SecretManagementServiceContracts";

export const SecretProviderMaterialKinds = Object.freeze({
  providerCredential: "provider-credential",
  signingMaterial: "signing-material",
  encryptionMaterial: "encryption-material",
  trustMaterial: "trust-material",
  generic: "generic",
});

export type SecretProviderMaterialKind =
  typeof SecretProviderMaterialKinds[keyof typeof SecretProviderMaterialKinds];

export interface SecretProviderMaterialSelector {
  readonly providerId: string;
  readonly secretId: string;
  readonly scope: SecretScopeOwner;
  readonly materialKind: SecretProviderMaterialKind;
}

export interface SecretProviderAccessContext {
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly usage: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolvedSecretProviderMaterialValue {
  readonly providerId: string;
  readonly secretId: string;
  readonly currentVersionId: string;
  readonly scope: SecretScopeOwner;
  readonly materialKind: SecretProviderMaterialKind;
  readonly rawValue: string;
}

export interface SecretProviderMaterialReference {
  readonly providerId: string;
  readonly secretId: string;
  readonly scope: SecretScopeOwner;
  readonly materialKind: SecretProviderMaterialKind;
  readonly reference: SecretReference;
}

export interface ResolveSecretProviderMaterialInput {
  readonly selector: SecretProviderMaterialSelector;
  readonly access: SecretProviderAccessContext;
}

export interface ResolveSecretProviderMaterialMetadataInput {
  readonly selector: SecretProviderMaterialSelector;
  readonly access: SecretProviderAccessContext;
}

export interface ResolveSecretProviderMaterialExistenceInput {
  readonly selector: SecretProviderMaterialSelector;
  readonly access: SecretProviderAccessContext;
}

export interface SecretProviderMaterialBootstrapInput {
  readonly selector: SecretProviderMaterialSelector;
  readonly access: SecretProviderAccessContext;
  readonly name: string;
  readonly kind: SecretKind;
  readonly plaintext: string;
  readonly metadata?: SecretReferenceMetadata;
}

export const SecretProviderBootstrapOutcomes = Object.freeze({
  created: "created",
  existing: "existing",
});

export type SecretProviderBootstrapOutcome =
  typeof SecretProviderBootstrapOutcomes[keyof typeof SecretProviderBootstrapOutcomes];

export interface SecretProviderBootstrapResult {
  readonly outcome: SecretProviderBootstrapOutcome;
  readonly reference: SecretProviderMaterialReference;
}

export interface ISecretProviderMaterialReadPort {
  resolveSecretProviderMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>>;
}

export interface ISecretProviderMaterialMetadataPort {
  resolveSecretProviderMaterialMetadata(
    input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<SecretServiceResult<SecretProviderMaterialReference>>;
  secretProviderMaterialExists(
    input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>>;
}

export interface ISecretProviderMaterialBootstrapPort {
  bootstrapSecretProviderMaterial(
    input: SecretProviderMaterialBootstrapInput,
  ): Promise<SecretServiceResult<SecretProviderBootstrapResult>>;
}

export interface ISecretProviderMaterialResolutionPort
  extends ISecretProviderMaterialReadPort, ISecretProviderMaterialMetadataPort, ISecretProviderMaterialBootstrapPort {}
