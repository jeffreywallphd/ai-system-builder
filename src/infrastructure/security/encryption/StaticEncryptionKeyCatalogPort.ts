import {
  EncryptionKeyScopes,
  type EncryptionKeyScope,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionKeyLifecycleStates,
  type EncryptionKeyDescriptor,
  type EncryptionKeyScopeOwner,
  type IEncryptionKeyCatalogPort,
  type ResolveActiveEncryptionKeyRequest,
  type ResolveEncryptionKeyByReferenceRequest,
} from "../../../application/security/ports/EncryptionKeyResolutionPorts";

export class StaticEncryptionKeyCatalogPort implements IEncryptionKeyCatalogPort {
  private readonly keysByReferenceId = new Map<string, EncryptionKeyDescriptor>();
  private readonly keysByScopeOwner = new Map<string, ReadonlyArray<EncryptionKeyDescriptor>>();

  public constructor(input: { readonly keys: ReadonlyArray<EncryptionKeyDescriptor> }) {
    for (const rawKey of input.keys) {
      const key = normalizeDescriptor(rawKey);
      if (this.keysByReferenceId.has(key.keyReferenceId)) {
        throw new Error(`Duplicate encryption key reference '${key.keyReferenceId}' is not allowed.`);
      }

      this.keysByReferenceId.set(key.keyReferenceId, key);
      const scopeOwnerId = toScopeOwnerId(key.scopeOwner);
      const current = this.keysByScopeOwner.get(scopeOwnerId) ?? [];
      this.keysByScopeOwner.set(scopeOwnerId, Object.freeze([...current, key]));
    }

    for (const [scopeOwnerId, keys] of this.keysByScopeOwner.entries()) {
      const sorted = [...keys].sort(compareByActivationThenReference);
      this.keysByScopeOwner.set(scopeOwnerId, Object.freeze(sorted));
    }
  }

  public async resolveActiveKeyForScope(
    request: ResolveActiveEncryptionKeyRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const scopeOwner = normalizeScopeOwner(request.scopeOwner);
    const keys = this.keysByScopeOwner.get(toScopeOwnerId(scopeOwner));
    if (!keys || keys.length === 0) {
      return undefined;
    }

    const occurredAt = normalizeOptionalTimestamp(request.occurredAt, "Resolve active encryption key occurredAt");
    const activeKeys = keys.filter((key) => key.lifecycleState === EncryptionKeyLifecycleStates.active);
    if (activeKeys.length === 0) {
      return undefined;
    }

    if (!occurredAt) {
      return activeKeys[activeKeys.length - 1];
    }

    const eligible = activeKeys.filter((key) => key.activatedAt <= occurredAt);
    if (eligible.length === 0) {
      return undefined;
    }
    return eligible[eligible.length - 1];
  }

  public async resolveKeyByReference(
    request: ResolveEncryptionKeyByReferenceRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const keyReferenceId = normalizeRequired(request.keyReferenceId, "Encryption key referenceId");
    return this.keysByReferenceId.get(keyReferenceId);
  }
}

function normalizeDescriptor(input: EncryptionKeyDescriptor): EncryptionKeyDescriptor {
  const scopeOwner = normalizeScopeOwner(input.scopeOwner);
  const metadata = normalizeMetadata(input.metadata);
  const lifecycleState = normalizeLifecycleState(input.lifecycleState);

  return Object.freeze({
    keyReferenceId: normalizeRequired(input.keyReferenceId, "Encryption key keyReferenceId"),
    keyId: normalizeRequired(input.keyId, "Encryption key keyId"),
    keyVersion: normalizeOptional(input.keyVersion),
    algorithm: normalizeRequired(input.algorithm, "Encryption key algorithm"),
    scopeOwner,
    lifecycleState,
    activatedAt: normalizeTimestamp(input.activatedAt, "Encryption key activatedAt"),
    rotatesAfter: normalizeOptionalTimestamp(input.rotatesAfter, "Encryption key rotatesAfter"),
    metadata,
  });
}

function normalizeScopeOwner(input: EncryptionKeyScopeOwner): EncryptionKeyScopeOwner {
  const scope = normalizeScope(input.scope);
  const workspaceId = normalizeOptional(input.workspaceId);
  const storageInstanceId = normalizeOptional(input.storageInstanceId);

  if (scope === EncryptionKeyScopes.server) {
    if (workspaceId || storageInstanceId) {
      throw new Error("Server-scope encryption keys cannot declare workspaceId or storageInstanceId.");
    }
    return Object.freeze({ scope });
  }

  if (scope === EncryptionKeyScopes.workspace) {
    if (!workspaceId) {
      throw new Error("Workspace-scope encryption keys require workspaceId.");
    }
    if (storageInstanceId) {
      throw new Error("Workspace-scope encryption keys cannot declare storageInstanceId.");
    }
    return Object.freeze({
      scope,
      workspaceId,
    });
  }

  if (!workspaceId) {
    throw new Error("Storage-instance-scope encryption keys require workspaceId.");
  }
  if (!storageInstanceId) {
    throw new Error("Storage-instance-scope encryption keys require storageInstanceId.");
  }
  return Object.freeze({
    scope,
    workspaceId,
    storageInstanceId,
  });
}

function normalizeScope(value: EncryptionKeyScope): EncryptionKeyScope {
  if (!Object.values(EncryptionKeyScopes).includes(value)) {
    throw new Error(`Encryption key scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeLifecycleState(value: EncryptionKeyDescriptor["lifecycleState"]): EncryptionKeyDescriptor["lifecycleState"] {
  if (!Object.values(EncryptionKeyLifecycleStates).includes(value)) {
    throw new Error(`Encryption key lifecycle state '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeMetadata(
  metadata: EncryptionKeyDescriptor["metadata"],
): Readonly<Record<string, string>> | undefined {
  if (!metadata) {
    return undefined;
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    normalized[normalizedKey] = normalizedValue;
  }
  return Object.freeze(normalized);
}

function compareByActivationThenReference(left: EncryptionKeyDescriptor, right: EncryptionKeyDescriptor): number {
  if (left.activatedAt < right.activatedAt) {
    return -1;
  }
  if (left.activatedAt > right.activatedAt) {
    return 1;
  }
  return left.keyReferenceId.localeCompare(right.keyReferenceId);
}

function toScopeOwnerId(owner: EncryptionKeyScopeOwner): string {
  if (owner.scope === EncryptionKeyScopes.server) {
    return owner.scope;
  }
  if (owner.scope === EncryptionKeyScopes.workspace) {
    return `${owner.scope}:${owner.workspaceId}`;
  }
  return `${owner.scope}:${owner.workspaceId}:${owner.storageInstanceId}`;
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

function normalizeTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeOptionalTimestamp(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return normalizeTimestamp(value, field);
}

