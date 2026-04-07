import type { SecretScope, SecretScopeOwner } from "@domain/security/SecretDomain";

export interface SecretActorDiagnosticDto {
  readonly actorId: string;
  readonly actorType: string;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretOwnerDiagnosticDto {
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface CreateSecretRequestDiagnosticDto {
  readonly actor: SecretActorDiagnosticDto;
  readonly operationKey?: string;
  readonly secretId?: string;
  readonly name?: string;
  readonly kind?: string;
  readonly owner?: SecretOwnerDiagnosticDto;
  readonly plaintextProvided: boolean;
}

export interface GetSecretMetadataRequestDiagnosticDto {
  readonly actor: SecretActorDiagnosticDto;
  readonly secretId?: string;
}

export function toCreateSecretRequestDiagnosticDto(input: {
  readonly actor: {
    readonly actorId: string;
    readonly actorType: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  };
  readonly operationKey?: string;
  readonly secretId?: string;
  readonly name?: string;
  readonly kind?: string;
  readonly owner?: SecretScopeOwner;
  readonly plaintext?: string;
}): CreateSecretRequestDiagnosticDto {
  return Object.freeze({
    actor: toSecretActorDiagnosticDto(input.actor),
    operationKey: normalizeOptional(input.operationKey),
    secretId: normalizeOptional(input.secretId),
    name: normalizeOptional(input.name),
    kind: normalizeOptional(input.kind),
    owner: input.owner ? toSecretOwnerDiagnosticDto(input.owner) : undefined,
    plaintextProvided: Boolean(input.plaintext && input.plaintext.trim()),
  });
}

export function toGetSecretMetadataRequestDiagnosticDto(input: {
  readonly actor: {
    readonly actorId: string;
    readonly actorType: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  };
  readonly secretId?: string;
}): GetSecretMetadataRequestDiagnosticDto {
  return Object.freeze({
    actor: toSecretActorDiagnosticDto(input.actor),
    secretId: normalizeOptional(input.secretId),
  });
}

export function toSecretOwnerDiagnosticDto(owner: SecretScopeOwner): SecretOwnerDiagnosticDto {
  return Object.freeze({
    scope: owner.scope,
    workspaceId: normalizeOptional(owner.workspaceId),
    userIdentityId: normalizeOptional(owner.userIdentityId),
  });
}

function toSecretActorDiagnosticDto(input: {
  readonly actorId: string;
  readonly actorType: string;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}): SecretActorDiagnosticDto {
  return Object.freeze({
    actorId: normalizeOptional(input.actorId) ?? "",
    actorType: normalizeOptional(input.actorType) ?? "",
    workspaceId: normalizeOptional(input.workspaceId),
    userIdentityId: normalizeOptional(input.userIdentityId),
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

