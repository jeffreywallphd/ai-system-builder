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
import type { IRuntimeSecurityMaterialResolverPort } from "@application/security/ports/SecurityMaterialResolutionPorts";

const SUPPORTED_ALGORITHM = "aes-256-gcm";
const LEGACY_REFERENCE_VERSION_TAG = "v1";

interface ParsedVersionedReference {
  readonly schema: "versioned-v2";
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly secretVersionId: string;
}

interface ParsedLegacyReference {
  readonly schema: "legacy-v1";
  readonly scopeOwner: EncryptionKeyScopeOwner;
}

type ParsedKeyReference = ParsedVersionedReference | ParsedLegacyReference;

interface ResolvedMaterial {
  readonly currentVersionId: string;
  readonly resolvedVersionId: string;
  readonly credential: string;
  readonly keyBytes: Uint8Array;
  readonly resolvedAt: string;
}

export interface VersionedServerScopedAssetContentEncryptionKeyPortInput {
  readonly runtimeSecurityMaterialResolver: Pick<IRuntimeSecurityMaterialResolverPort, "resolveServerSigningMaterial">;
  readonly secretId: string;
  readonly keyPrefix?: string;
  readonly serviceIdentity?: string;
  readonly signingPurpose?: string;
  readonly fallbackEncodedKey?: string;
  readonly fallbackVersionId?: string;
  readonly legacyDeterministicVersionId?: string;
  readonly now?: () => Date;
}

export class VersionedServerScopedAssetContentEncryptionKeyPort
  implements IEncryptionKeyCatalogPort, IEncryptionKeyMaterialPort {
  private readonly keyPrefix: string;
  private readonly serviceIdentity: string;
  private readonly signingPurpose: string;
  private readonly now: () => Date;
  private readonly fallbackKeyBytes: Uint8Array | undefined;
  private readonly fallbackVersionId: string;
  private readonly legacyDeterministicVersionId: string;
  private operationCounter = 0;

  public constructor(private readonly input: VersionedServerScopedAssetContentEncryptionKeyPortInput) {
    this.keyPrefix = normalizeRequired(
      input.keyPrefix ?? "kek:asset-content",
      "Asset content key prefix",
    );
    this.serviceIdentity = normalizeRequired(
      input.serviceIdentity ?? "runtime:server:asset-content-encryption-key-port",
      "Asset content key resolver serviceIdentity",
    );
    this.signingPurpose = normalizeRequired(
      input.signingPurpose ?? "asset-content-encryption",
      "Asset content key resolver signingPurpose",
    );
    this.now = input.now ?? (() => new Date());
    this.fallbackKeyBytes = input.fallbackEncodedKey
      ? decodeAes256Key(input.fallbackEncodedKey)
      : undefined;
    this.fallbackVersionId = normalizeRequired(
      input.fallbackVersionId ?? `${input.secretId}:fallback`,
      "Asset content key fallbackVersionId",
    );
    this.legacyDeterministicVersionId = normalizeRequired(
      input.legacyDeterministicVersionId ?? `${input.secretId}:v1`,
      "Asset content key legacyDeterministicVersionId",
    );
  }

  public async resolveActiveKeyForScope(
    request: ResolveActiveEncryptionKeyRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const scopeOwner = normalizeScopeOwner(request.scopeOwner);
    const resolved = await this.resolveMaterial({
      scopeOwner,
      occurredAt: normalizeOptionalTimestamp(request.occurredAt),
      operationPurpose: "resolve-active-key",
    });
    if (!resolved) {
      return undefined;
    }

    return buildDescriptor({
      keyReferenceId: buildVersionedReference(this.keyPrefix, scopeOwner, resolved.currentVersionId),
      keyId: buildKeyId(this.input.secretId, scopeOwner, resolved.currentVersionId),
      keyVersion: resolved.currentVersionId,
      scopeOwner,
      lifecycleState: EncryptionKeyLifecycleStates.active,
      activatedAt: resolved.resolvedAt,
      metadata: Object.freeze({
        materialSecretId: this.input.secretId,
        keyReferenceSchema: "versioned-v2",
      }),
    });
  }

  public async resolveKeyByReference(
    request: ResolveEncryptionKeyByReferenceRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    const keyReferenceId = normalizeRequired(request.keyReferenceId, "Asset content key referenceId");
    const parsed = parseKeyReference(this.keyPrefix, keyReferenceId);
    if (!parsed) {
      return undefined;
    }

    const requestedVersionId = parsed.schema === "versioned-v2"
      ? parsed.secretVersionId
      : this.legacyDeterministicVersionId;
    const resolved = await this.resolveMaterial({
      scopeOwner: parsed.scopeOwner,
      requestedVersionId,
      allowSupersededVersion: true,
      occurredAt: undefined,
      operationPurpose: "resolve-reference-key",
    });
    if (!resolved) {
      return undefined;
    }

    const lifecycleState = resolved.currentVersionId === requestedVersionId
      ? EncryptionKeyLifecycleStates.active
      : EncryptionKeyLifecycleStates.retiring;
    const resolvedReferenceId = parsed.schema === "versioned-v2"
      ? keyReferenceId
      : buildVersionedReference(this.keyPrefix, parsed.scopeOwner, requestedVersionId);

    return buildDescriptor({
      keyReferenceId: resolvedReferenceId,
      keyId: buildKeyId(this.input.secretId, parsed.scopeOwner, requestedVersionId),
      keyVersion: requestedVersionId,
      scopeOwner: parsed.scopeOwner,
      lifecycleState,
      activatedAt: resolved.resolvedAt,
      metadata: Object.freeze({
        materialSecretId: this.input.secretId,
        keyReferenceSchema: parsed.schema,
      }),
    });
  }

  public async resolveKeyMaterialByReference(
    request: ResolveEncryptionKeyMaterialRequest,
  ): Promise<EncryptionKeyMaterialDescriptor | undefined> {
    const keyReferenceId = normalizeRequired(request.keyReferenceId, "Asset content key material referenceId");
    const parsed = parseKeyReference(this.keyPrefix, keyReferenceId);
    if (!parsed) {
      return undefined;
    }

    const requestedVersionId = parsed.schema === "versioned-v2"
      ? parsed.secretVersionId
      : this.legacyDeterministicVersionId;
    const resolved = await this.resolveMaterial({
      scopeOwner: parsed.scopeOwner,
      requestedVersionId,
      allowSupersededVersion: true,
      occurredAt: undefined,
      operationPurpose: "resolve-key-material",
    });
    if (!resolved) {
      return undefined;
    }

    return Object.freeze({
      keyReferenceId,
      algorithm: SUPPORTED_ALGORITHM,
      keyBytes: resolved.keyBytes,
    });
  }

  private async resolveMaterial(input: {
    readonly scopeOwner: EncryptionKeyScopeOwner;
    readonly requestedVersionId?: string;
    readonly allowSupersededVersion?: boolean;
    readonly occurredAt?: string;
    readonly operationPurpose: string;
  }): Promise<ResolvedMaterial | undefined> {
    const materialResult = await this.input.runtimeSecurityMaterialResolver.resolveServerSigningMaterial({
      secretId: this.input.secretId,
      operationKey: this.nextOperationKey(input.operationPurpose),
      serviceIdentity: this.serviceIdentity,
      signingPurpose: this.signingPurpose,
      versionId: input.requestedVersionId,
      allowSupersededVersion: input.allowSupersededVersion,
      justification: buildJustification({
        secretId: this.input.secretId,
        scopeOwner: input.scopeOwner,
        requestedVersionId: input.requestedVersionId,
      }),
      occurredAt: input.occurredAt,
    });

    if (!materialResult.ok) {
      if (materialResult.error.code !== "secret-not-found") {
        throw new Error(
          `Asset content key resolution failed (${materialResult.error.code}): ${materialResult.error.message}`,
        );
      }

      if (!this.fallbackKeyBytes) {
        return undefined;
      }
      if (input.requestedVersionId && input.requestedVersionId !== this.fallbackVersionId) {
        return undefined;
      }

      const resolvedAt = input.occurredAt ?? this.now().toISOString();
      return Object.freeze({
        currentVersionId: this.fallbackVersionId,
        resolvedVersionId: this.fallbackVersionId,
        credential: "",
        keyBytes: this.fallbackKeyBytes,
        resolvedAt,
      });
    }

    return Object.freeze({
      currentVersionId: materialResult.value.currentVersionId,
      resolvedVersionId: input.requestedVersionId ?? materialResult.value.currentVersionId,
      credential: materialResult.value.credential,
      keyBytes: decodeAes256Key(materialResult.value.credential),
      resolvedAt: input.occurredAt ?? this.now().toISOString(),
    });
  }

  private nextOperationKey(operationPurpose: string): string {
    this.operationCounter += 1;
    return [
      "op:runtime:asset-content-key",
      operationPurpose,
      this.now().getTime(),
      this.operationCounter,
    ].join(":");
  }
}

function buildDescriptor(input: {
  readonly keyReferenceId: string;
  readonly keyId: string;
  readonly keyVersion: string;
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly lifecycleState: EncryptionKeyDescriptor["lifecycleState"];
  readonly activatedAt: string;
  readonly metadata: Readonly<Record<string, string>>;
}): EncryptionKeyDescriptor {
  return Object.freeze({
    keyReferenceId: input.keyReferenceId,
    keyId: input.keyId,
    keyVersion: input.keyVersion,
    algorithm: SUPPORTED_ALGORITHM,
    scopeOwner: input.scopeOwner,
    lifecycleState: input.lifecycleState,
    activatedAt: input.activatedAt,
    metadata: input.metadata,
  });
}

function buildKeyId(secretId: string, scopeOwner: EncryptionKeyScopeOwner, versionId: string): string {
  return [
    secretId,
    scopeOwner.scope,
    scopeOwner.workspaceId ?? "",
    scopeOwner.storageInstanceId ?? "",
    versionId,
  ].join("|");
}

function buildJustification(input: {
  readonly secretId: string;
  readonly scopeOwner: EncryptionKeyScopeOwner;
  readonly requestedVersionId?: string;
}): string {
  const scopeSuffix = input.scopeOwner.scope === EncryptionKeyScopes.server
    ? "server"
    : input.scopeOwner.scope === EncryptionKeyScopes.workspace
      ? `workspace:${input.scopeOwner.workspaceId}`
      : `storage-instance:${input.scopeOwner.workspaceId}:${input.scopeOwner.storageInstanceId}`;
  if (input.requestedVersionId) {
    return `resolve asset-content encryption key '${input.secretId}' for ${scopeSuffix} using version '${input.requestedVersionId}'`;
  }
  return `resolve active asset-content encryption key '${input.secretId}' for ${scopeSuffix}`;
}

function buildVersionedReference(
  keyPrefix: string,
  scopeOwner: EncryptionKeyScopeOwner,
  secretVersionId: string,
): string {
  const scopeToken = Buffer.from(JSON.stringify(scopeOwner), "utf8").toString("base64url");
  const versionToken = Buffer.from(secretVersionId, "utf8").toString("base64url");
  return `${keyPrefix}:scope:${scopeToken}:version:${versionToken}`;
}

function parseKeyReference(
  keyPrefix: string,
  keyReferenceId: string,
): ParsedKeyReference | undefined {
  const normalizedReference = normalizeRequired(keyReferenceId, "Asset content key referenceId");
  const versionedPrefix = `${keyPrefix}:scope:`;
  if (normalizedReference.startsWith(versionedPrefix)) {
    try {
      const suffix = normalizedReference.slice(versionedPrefix.length);
      const marker = ":version:";
      const markerIndex = suffix.indexOf(marker);
      if (markerIndex <= 0) {
        return undefined;
      }
      const scopeToken = suffix.slice(0, markerIndex);
      const versionToken = suffix.slice(markerIndex + marker.length);
      if (!scopeToken || !versionToken) {
        return undefined;
      }

      const scopeOwner = normalizeScopeOwner(
        JSON.parse(Buffer.from(scopeToken, "base64url").toString("utf8")) as EncryptionKeyScopeOwner,
      );
      const secretVersionId = normalizeRequired(
        Buffer.from(versionToken, "base64url").toString("utf8"),
        "Asset content key secretVersionId",
      );

      return Object.freeze({
        schema: "versioned-v2" as const,
        scopeOwner,
        secretVersionId,
      });
    } catch {
      return undefined;
    }
  }

  return parseLegacyReference(keyPrefix, normalizedReference);
}

function parseLegacyReference(
  keyPrefix: string,
  keyReferenceId: string,
): ParsedLegacyReference | undefined {
  const expectedPrefix = `${keyPrefix}:`;
  if (!keyReferenceId.startsWith(expectedPrefix)) {
    return undefined;
  }

  const suffix = keyReferenceId.slice(expectedPrefix.length);
  const parts = suffix.split(":");
  if (parts.length < 2 || parts[parts.length - 1] !== LEGACY_REFERENCE_VERSION_TAG) {
    return undefined;
  }

  const scope = parts[0] as EncryptionKeyScope;
  if (!Object.values(EncryptionKeyScopes).includes(scope)) {
    return undefined;
  }

  if (scope === EncryptionKeyScopes.server && parts.length === 2) {
    return Object.freeze({
      schema: "legacy-v1" as const,
      scopeOwner: Object.freeze({ scope }),
    });
  }

  if (scope === EncryptionKeyScopes.workspace && parts.length === 3) {
    return Object.freeze({
      schema: "legacy-v1" as const,
      scopeOwner: Object.freeze({
        scope,
        workspaceId: normalizeRequired(parts[1], "Asset content key workspaceId"),
      }),
    });
  }

  if (scope === EncryptionKeyScopes.storageInstance && parts.length === 4) {
    return Object.freeze({
      schema: "legacy-v1" as const,
      scopeOwner: Object.freeze({
        scope,
        workspaceId: normalizeRequired(parts[1], "Asset content key workspaceId"),
        storageInstanceId: normalizeRequired(parts[2], "Asset content key storageInstanceId"),
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
      workspaceId: normalizeRequired(value.workspaceId, "Asset content key workspaceId"),
    });
  }
  return Object.freeze({
    scope,
    workspaceId: normalizeRequired(value.workspaceId, "Asset content key workspaceId"),
    storageInstanceId: normalizeRequired(value.storageInstanceId, "Asset content key storageInstanceId"),
  });
}

function decodeAes256Key(encodedKey: string): Uint8Array {
  const normalized = normalizeRequired(encodedKey, "Asset content key encoded value");
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

  throw new Error("Asset content encryption key must be 32 bytes (base64 or 64-char hex).");
}

function normalizeOptionalTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Asset content key occurredAt must be a valid timestamp.");
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
