import {
  EncryptionKeyScopes,
  type EncryptionKeyScope,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionKeyLifecycleStates,
  type EncryptionKeyDescriptor,
  type EncryptionKeyScopeOwner,
  type IEncryptionKeyCatalogPort,
  type ResolveActiveEncryptionKeyRequest,
  type ResolveEncryptionKeyByReferenceRequest,
} from "@application/security/ports/EncryptionKeyResolutionPorts";
import type {
  EncryptionKeyMaterialDescriptor,
  IEncryptionKeyMaterialPort,
  ResolveEncryptionKeyMaterialRequest,
} from "@application/security/ports/ProtectedValueEncryptionPorts";

const VERSION_TAG = "v1";

export interface DeterministicScopeEncryptionKeyPortInput {
  readonly encodedKey: string;
  readonly keyPrefix?: string;
  readonly activatedAt?: string;
}

export class DeterministicScopeEncryptionKeyPort implements IEncryptionKeyCatalogPort, IEncryptionKeyMaterialPort {
  private readonly keyBytes: Uint8Array;
  private readonly keyPrefix: string;
  private readonly activatedAt: string;

  public constructor(input: DeterministicScopeEncryptionKeyPortInput) {
    this.keyBytes = decodeAes256Key(input.encodedKey);
    this.keyPrefix = normalizeRequired(input.keyPrefix ?? "kek:asset-content", "Deterministic key prefix");
    this.activatedAt = normalizeTimestamp(input.activatedAt ?? "2026-01-01T00:00:00.000Z", "Deterministic key activatedAt");
  }

  public async resolveActiveKeyForScope(
    request: ResolveActiveEncryptionKeyRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const scopeOwner = normalizeScopeOwner(request.scopeOwner);
    return buildDescriptor(this.keyPrefix, scopeOwner, this.activatedAt);
  }

  public async resolveKeyByReference(
    request: ResolveEncryptionKeyByReferenceRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const parsed = parseReference(this.keyPrefix, request.keyReferenceId);
    if (!parsed) {
      return undefined;
    }
    return buildDescriptor(this.keyPrefix, parsed.scopeOwner, this.activatedAt);
  }

  public async resolveKeyMaterialByReference(
    request: ResolveEncryptionKeyMaterialRequest,
  ): Promise<EncryptionKeyMaterialDescriptor | undefined> {
    const parsed = parseReference(this.keyPrefix, request.keyReferenceId);
    if (!parsed) {
      return undefined;
    }

    return Object.freeze({
      keyReferenceId: parsed.keyReferenceId,
      algorithm: "aes-256-gcm",
      keyBytes: this.keyBytes,
    });
  }
}

function buildDescriptor(
  keyPrefix: string,
  scopeOwner: EncryptionKeyScopeOwner,
  activatedAt: string,
): EncryptionKeyDescriptor {
  const reference = buildReference(keyPrefix, scopeOwner);

  return Object.freeze({
    keyReferenceId: reference,
    keyId: `${keyPrefix}:${reference.split(":").slice(2, -1).join(":")}`,
    keyVersion: VERSION_TAG,
    algorithm: "aes-256-gcm",
    scopeOwner,
    lifecycleState: EncryptionKeyLifecycleStates.active,
    activatedAt,
  });
}

function buildReference(keyPrefix: string, scopeOwner: EncryptionKeyScopeOwner): string {
  if (scopeOwner.scope === EncryptionKeyScopes.server) {
    return `${keyPrefix}:server:${VERSION_TAG}`;
  }
  if (scopeOwner.scope === EncryptionKeyScopes.workspace) {
    return `${keyPrefix}:workspace:${scopeOwner.workspaceId}:${VERSION_TAG}`;
  }
  return `${keyPrefix}:storage-instance:${scopeOwner.workspaceId}:${scopeOwner.storageInstanceId}:${VERSION_TAG}`;
}

function parseReference(
  keyPrefix: string,
  keyReferenceId: string,
): { readonly keyReferenceId: string; readonly scopeOwner: EncryptionKeyScopeOwner } | undefined {
  const normalized = normalizeRequired(keyReferenceId, "Key reference id");
  const expectedPrefix = `${keyPrefix}:`;
  if (!normalized.startsWith(expectedPrefix)) {
    return undefined;
  }

  const suffix = normalized.slice(expectedPrefix.length);
  const parts = suffix.split(":");
  if (parts.length < 2 || parts[parts.length - 1] !== VERSION_TAG) {
    return undefined;
  }

  const scope = parts[0] as EncryptionKeyScope;
  if (!Object.values(EncryptionKeyScopes).includes(scope)) {
    return undefined;
  }

  if (scope === EncryptionKeyScopes.server && parts.length === 2) {
    return Object.freeze({
      keyReferenceId: normalized,
      scopeOwner: Object.freeze({ scope }),
    });
  }

  if (scope === EncryptionKeyScopes.workspace && parts.length === 3) {
    const workspaceId = normalizeRequired(parts[1], "Key scope workspaceId");
    return Object.freeze({
      keyReferenceId: normalized,
      scopeOwner: Object.freeze({
        scope,
        workspaceId,
      }),
    });
  }

  if (scope === EncryptionKeyScopes.storageInstance && parts.length === 4) {
    const workspaceId = normalizeRequired(parts[1], "Key scope workspaceId");
    const storageInstanceId = normalizeRequired(parts[2], "Key scope storageInstanceId");
    return Object.freeze({
      keyReferenceId: normalized,
      scopeOwner: Object.freeze({
        scope,
        workspaceId,
        storageInstanceId,
      }),
    });
  }

  return undefined;
}

function normalizeScopeOwner(value: EncryptionKeyScopeOwner): EncryptionKeyScopeOwner {
  const scope = value.scope;
  if (!Object.values(EncryptionKeyScopes).includes(scope)) {
    throw new Error(`Encryption key scope '${String(scope)}' is invalid.`);
  }

  if (scope === EncryptionKeyScopes.server) {
    return Object.freeze({ scope });
  }

  if (scope === EncryptionKeyScopes.workspace) {
    return Object.freeze({
      scope,
      workspaceId: normalizeRequired(value.workspaceId, "Encryption key scope workspaceId"),
    });
  }

  return Object.freeze({
    scope,
    workspaceId: normalizeRequired(value.workspaceId, "Encryption key scope workspaceId"),
    storageInstanceId: normalizeRequired(value.storageInstanceId, "Encryption key scope storageInstanceId"),
  });
}

function decodeAes256Key(encodedKey: string): Uint8Array {
  const normalized = normalizeRequired(encodedKey, "Deterministic key encoded key");
  const asBase64 = Buffer.from(normalized, "base64");
  if (asBase64.length === 32) {
    return asBase64;
  }

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const asHex = Buffer.from(normalized, "hex");
    if (asHex.length === 32) {
      return asHex;
    }
  }

  throw new Error("Deterministic key must be 32 bytes (base64 or 64-char hex).");
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeRequired(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

