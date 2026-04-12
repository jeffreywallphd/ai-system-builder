import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { SecretKinds, SecretScopes, type SecretReference, type SecretReferenceMetadata } from "@domain/security/SecretDomain";
import {
  SecurityMaterialRotationCutoverStrategies,
  SecurityMaterialRotationPolicyModes,
  SecurityMaterialRotationVersionStates,
  type SecurityMaterialRotationPolicyMetadata,
  type SecurityMaterialRotationVersionContract,
} from "@application/security/contracts/SecurityMaterialRotationContract";
import {
  SecretProviderMaterialBackendKinds,
  SecretProviderBootstrapOutcomes,
  SecretProviderMaterialRotationStatuses,
  type ResolveSecretProviderMaterialExistenceInput,
  type ResolveSecretProviderMaterialInput,
  type ResolveSecretProviderMaterialMetadataInput,
  type SecretProviderMaterialMetadata,
  type ResolvedSecretProviderMaterialValue,
  type SecretProviderBootstrapResult,
  type SecretProviderMaterialBootstrapInput,
} from "@application/security/ports/SecretProviderPorts";
import {
  SecretServiceErrorCodes,
  type SecretServiceResult,
} from "@application/security/use-cases/SecretManagementServiceContracts";

export interface LocalUserSecretCredentialStore {
  getSecret(account: string): Promise<string | undefined>;
  setSecret(account: string, value: string): Promise<void>;
}

export interface LocalUserSecureSecretStoreBackendDependencies {
  readonly credentialStore: LocalUserSecretCredentialStore;
  readonly clock?: () => Date;
}

interface StoredLocalSecretMetadata {
  readonly kind: SecretReference["kind"];
  readonly name: string;
  readonly metadata: SecretReferenceMetadata;
  readonly updatedAt: string;
  readonly currentVersionId: string;
  readonly rotation?: StoredLocalSecretRotationMetadata;
}

interface StoredLocalSecretRotationMetadata {
  readonly currentVersionId: string;
  readonly previousVersionId?: string;
  readonly pendingVersionId?: string;
  readonly effectiveAsOf?: string;
  readonly versions?: ReadonlyArray<Partial<SecurityMaterialRotationVersionContract>>;
  readonly policy?: SecurityMaterialRotationPolicyMetadata;
}

export class LocalUserSecureSecretStoreBackend {
  private readonly clock: () => Date;

  public constructor(private readonly dependencies: LocalUserSecureSecretStoreBackendDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
  }

  public async resolveUserMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    if (input.selector.scope.scope !== SecretScopes.user) {
      return createInvalidScopeResult();
    }
    const material = await this.dependencies.credentialStore.getSecret(toMaterialAccount(input.selector));
    if (!material) {
      return createNotFoundResult(input.selector.secretId);
    }

    const metadata = await this.readMetadata(input.selector);
    return {
      ok: true,
      value: Object.freeze({
        providerId: input.selector.providerId,
        secretId: input.selector.secretId,
        currentVersionId: metadata?.rotation?.currentVersionId ?? metadata?.currentVersionId ?? toVersionId(input.selector.secretId, material),
        scope: input.selector.scope,
        materialKind: input.selector.materialKind,
        rawValue: material,
      }),
    };
  }

  public async resolveUserMaterialMetadata(
    input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    if (input.selector.scope.scope !== SecretScopes.user) {
      return createInvalidScopeResult();
    }

    const material = await this.dependencies.credentialStore.getSecret(toMaterialAccount(input.selector));
    if (!material) {
      return createNotFoundResult(input.selector.secretId);
    }

    const storedMetadata = await this.readMetadata(input.selector);
    const reference = await this.resolveReference(input.selector, material, storedMetadata);
    return {
      ok: true,
      value: toSecretProviderMaterialMetadata({
        selector: input.selector,
        reference,
        backendKind: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
        rotation: storedMetadata?.rotation,
      }),
    };
  }

  public async userMaterialExists(
    input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    if (input.selector.scope.scope !== SecretScopes.user) {
      return createInvalidScopeResult();
    }

    const material = await this.dependencies.credentialStore.getSecret(toMaterialAccount(input.selector));
    return {
      ok: true,
      value: Object.freeze({
        exists: Boolean(material),
      }),
    };
  }

  public async bootstrapUserMaterial(
    input: SecretProviderMaterialBootstrapInput,
  ): Promise<SecretServiceResult<SecretProviderBootstrapResult>> {
    if (input.selector.scope.scope !== SecretScopes.user) {
      return createInvalidScopeResult();
    }

    const existingMaterial = await this.dependencies.credentialStore.getSecret(toMaterialAccount(input.selector));
    if (existingMaterial) {
      const storedMetadata = await this.readMetadata(input.selector);
      const reference = await this.resolveReference(input.selector, existingMaterial, storedMetadata);
      return {
        ok: true,
        value: Object.freeze({
          outcome: SecretProviderBootstrapOutcomes.existing,
          reference: toSecretProviderMaterialMetadata({
            selector: input.selector,
            reference,
            backendKind: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
            rotation: storedMetadata?.rotation,
          }),
        }),
      };
    }

    const updatedAt = normalizeTimestamp(input.access.occurredAt, this.clock);
    const currentVersionId = toVersionId(input.selector.secretId, input.plaintext);
    const metadataRecord: StoredLocalSecretMetadata = Object.freeze({
      kind: input.kind,
      name: input.name,
      metadata: toReferenceMetadata(input.metadata),
      updatedAt,
      currentVersionId,
      rotation: Object.freeze({
        currentVersionId,
        previousVersionId: undefined,
        pendingVersionId: undefined,
        effectiveAsOf: updatedAt,
        versions: Object.freeze([
          Object.freeze({
            versionId: currentVersionId,
            state: SecurityMaterialRotationVersionStates.active,
            effectiveFrom: updatedAt,
          }),
        ]),
        policy: Object.freeze({
          rotationMode: SecurityMaterialRotationPolicyModes.manual,
          cutoverStrategy: SecurityMaterialRotationCutoverStrategies.immediate,
        }),
      }),
    });

    await this.dependencies.credentialStore.setSecret(toMaterialAccount(input.selector), input.plaintext);
    await this.dependencies.credentialStore.setSecret(
      toMetadataAccount(input.selector),
      JSON.stringify(metadataRecord),
    );

    return {
      ok: true,
      value: Object.freeze({
        outcome: SecretProviderBootstrapOutcomes.created,
        reference: toSecretProviderMaterialMetadata({
          selector: input.selector,
          backendKind: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
          rotation: metadataRecord.rotation,
          reference: Object.freeze({
            secretId: input.selector.secretId,
            name: metadataRecord.name,
            scope: input.selector.scope.scope,
            workspaceId: input.selector.scope.workspaceId,
            userIdentityId: input.selector.scope.userIdentityId,
            kind: metadataRecord.kind,
            state: "active",
            currentVersionId: metadataRecord.currentVersionId,
            metadata: metadataRecord.metadata,
            updatedAt: metadataRecord.updatedAt,
          }),
        }),
      }),
    };
  }

  private async resolveReference(
    selector: ResolveSecretProviderMaterialInput["selector"],
    material: string,
    metadata: StoredLocalSecretMetadata | undefined,
  ): Promise<SecretReference> {
    if (metadata) {
      return Object.freeze({
        secretId: selector.secretId,
        name: metadata.name,
        scope: selector.scope.scope,
        workspaceId: selector.scope.workspaceId,
        userIdentityId: selector.scope.userIdentityId,
        kind: metadata.kind,
        state: "active",
        currentVersionId: metadata.currentVersionId,
        metadata: metadata.metadata,
        updatedAt: metadata.updatedAt,
      });
    }

    const updatedAt = normalizeTimestamp(undefined, this.clock);
    return Object.freeze({
      secretId: selector.secretId,
      name: toFallbackReferenceName(selector.secretId, selector.providerId),
      scope: selector.scope.scope,
      workspaceId: selector.scope.workspaceId,
      userIdentityId: selector.scope.userIdentityId,
      kind: SecretKinds.apiKey,
      state: "active",
      currentVersionId: toVersionId(selector.secretId, material),
      metadata: Object.freeze({
        tags: Object.freeze(["local-user-secure-store"]),
        labels: Object.freeze({
          provider: selector.providerId,
          backend: "device-local",
        }),
      }),
      updatedAt,
    });
  }

  private async readMetadata(
    selector: ResolveSecretProviderMaterialInput["selector"],
  ): Promise<StoredLocalSecretMetadata | undefined> {
    const raw = await this.dependencies.credentialStore.getSecret(toMetadataAccount(selector));
    if (!raw) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredLocalSecretMetadata>;
      if (
        typeof parsed.name !== "string"
        || typeof parsed.kind !== "string"
        || typeof parsed.updatedAt !== "string"
        || typeof parsed.currentVersionId !== "string"
      ) {
        return undefined;
      }
      return Object.freeze({
        kind: parsed.kind as SecretReference["kind"],
        name: parsed.name,
        metadata: toReferenceMetadata(parsed.metadata),
        updatedAt: parsed.updatedAt,
        currentVersionId: parsed.currentVersionId,
        rotation: normalizeRotationMetadata(parsed.rotation, parsed.currentVersionId, parsed.updatedAt),
      });
    } catch {
      return undefined;
    }
  }
}

interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
}

class KeytarCredentialStore implements LocalUserSecretCredentialStore {
  public constructor(
    private readonly keytar: KeytarLike,
    private readonly serviceName: string,
  ) {}

  public async getSecret(account: string): Promise<string | undefined> {
    const value = await this.keytar.getPassword(this.serviceName, account);
    return value ?? undefined;
  }

  public async setSecret(account: string, value: string): Promise<void> {
    await this.keytar.setPassword(this.serviceName, account, value);
  }
}

export interface OptionalKeytarCredentialStoreResolution {
  readonly available: boolean;
  readonly credentialStore?: LocalUserSecretCredentialStore;
  readonly reason?: string;
}

export function resolveOptionalKeytarCredentialStore(input?: {
  readonly serviceName?: string;
}): OptionalKeytarCredentialStoreResolution {
  try {
    const require = createRequire(import.meta.url);
    const module = require("keytar") as Partial<KeytarLike>;
    if (typeof module.getPassword !== "function" || typeof module.setPassword !== "function") {
      return Object.freeze({
        available: false,
        reason: "keytar-module-missing-required-apis",
      });
    }

    return Object.freeze({
      available: true,
      credentialStore: new KeytarCredentialStore(module as KeytarLike, input?.serviceName ?? "ai-loom-studio"),
    });
  } catch (error: unknown) {
    return Object.freeze({
      available: false,
      reason: `keytar-unavailable:${normalizeError(error)}`,
    });
  }
}

export function createLocalUserSecureSecretStoreBackendFromKeytar(input?: {
  readonly serviceName?: string;
  readonly clock?: () => Date;
}): {
  readonly backend?: LocalUserSecureSecretStoreBackend;
  readonly keytar: OptionalKeytarCredentialStoreResolution;
} {
  const keytar = resolveOptionalKeytarCredentialStore({
    serviceName: input?.serviceName,
  });
  if (!keytar.available || !keytar.credentialStore) {
    return Object.freeze({
      backend: undefined,
      keytar,
    });
  }

  return Object.freeze({
    backend: new LocalUserSecureSecretStoreBackend({
      credentialStore: keytar.credentialStore,
      clock: input?.clock,
    }),
    keytar,
  });
}

function toMaterialAccount(selector: ResolveSecretProviderMaterialInput["selector"]): string {
  return `${toAccountKey(selector)}:material`;
}

function toMetadataAccount(selector: ResolveSecretProviderMaterialInput["selector"]): string {
  return `${toAccountKey(selector)}:metadata`;
}

function toAccountKey(selector: ResolveSecretProviderMaterialInput["selector"]): string {
  return [
    "provider",
    selector.providerId,
    "scope",
    selector.scope.scope,
    selector.scope.workspaceId ?? "none",
    selector.scope.userIdentityId ?? "none",
    "secret",
    selector.secretId,
    "kind",
    selector.materialKind,
  ].join("|");
}

function toVersionId(secretId: string, plaintext: string): string {
  const digest = createHash("sha256").update(plaintext).digest("hex").slice(0, 16);
  return `${secretId}:local-${digest}`;
}

function toReferenceMetadata(
  metadata: SecretReferenceMetadata | Partial<SecretReferenceMetadata> | undefined,
): SecretReferenceMetadata {
  return Object.freeze({
    tags: Object.freeze([...(metadata?.tags ?? [])]),
    labels: Object.freeze({ ...(metadata?.labels ?? {}) }),
    displayName: metadata?.displayName,
    description: metadata?.description,
  });
}

function toFallbackReferenceName(secretId: string, providerId: string): string {
  const digest = createHash("sha256").update(secretId).digest("hex").slice(0, 12);
  return `local.${providerId}.${digest}`;
}

function createInvalidScopeResult(): SecretServiceResult<never> {
  return {
    ok: false,
    error: {
      code: SecretServiceErrorCodes.invalidRequest,
      message: "Local user secure secret store backend only supports user scope selectors.",
    },
  };
}

function createNotFoundResult(secretId: string): SecretServiceResult<never> {
  return {
    ok: false,
    error: {
      code: SecretServiceErrorCodes.notFound,
      message: `User-scoped local secure secret '${secretId}' was not found.`,
    },
  };
}

function normalizeTimestamp(value: string | undefined, clock: () => Date): string {
  const candidate = value?.trim() ?? clock().toISOString();
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return clock().toISOString();
  }
  return parsed.toISOString();
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toSecretProviderMaterialMetadata(input: {
  readonly selector: ResolveSecretProviderMaterialInput["selector"];
  readonly reference: SecretReference;
  readonly backendKind: typeof SecretProviderMaterialBackendKinds[keyof typeof SecretProviderMaterialBackendKinds];
  readonly rotation?: StoredLocalSecretRotationMetadata;
}): SecretProviderMaterialMetadata {
  const currentVersionId = input.rotation?.currentVersionId ?? input.reference.currentVersionId;
  const versions = input.rotation?.versions
    ?? (currentVersionId
      ? Object.freeze([
        Object.freeze({
          versionId: currentVersionId,
          state: SecurityMaterialRotationVersionStates.active,
          effectiveFrom: input.reference.updatedAt,
        }),
      ])
      : Object.freeze([]));

  return Object.freeze({
    providerId: input.selector.providerId,
    secretId: input.selector.secretId,
    scope: input.selector.scope,
    materialKind: input.selector.materialKind,
    backend: Object.freeze({
      backendId: input.backendKind,
      backendKind: input.backendKind,
    }),
    reference: input.reference,
    timestamps: Object.freeze({
      updatedAt: input.reference.updatedAt,
    }),
    rotation: Object.freeze({
      status: toRotationStatus(input.reference.state),
      currentVersionId,
      previousVersionId: input.rotation?.previousVersionId,
      pendingVersionId: input.rotation?.pendingVersionId,
      effectiveAsOf: input.rotation?.effectiveAsOf ?? input.reference.updatedAt,
      versions,
      policy: input.rotation?.policy ?? Object.freeze({
        rotationMode: SecurityMaterialRotationPolicyModes.manual,
      }),
    }),
    policyFlags: Object.freeze({
      metadataSafeForDiagnostics: true,
      plaintextAccessRequiresDedicatedRetrievalFlow: true,
    }),
  });
}

function toRotationStatus(
  state: SecretReference["state"],
): typeof SecretProviderMaterialRotationStatuses[keyof typeof SecretProviderMaterialRotationStatuses] {
  if (state === "active") {
    return SecretProviderMaterialRotationStatuses.active;
  }
  if (state === "disabled") {
    return SecretProviderMaterialRotationStatuses.disabled;
  }
  if (state === "archived") {
    return SecretProviderMaterialRotationStatuses.archived;
  }
  if (state === "soft-deleted") {
    return SecretProviderMaterialRotationStatuses.softDeleted;
  }
  return SecretProviderMaterialRotationStatuses.unknown;
}

function normalizeRotationMetadata(
  rotation: unknown,
  fallbackCurrentVersionId: string,
  fallbackUpdatedAt: string,
): StoredLocalSecretRotationMetadata {
  const parsed = (rotation ?? {}) as Partial<StoredLocalSecretRotationMetadata>;
  const currentVersionId = normalizeOptional(parsed.currentVersionId) ?? fallbackCurrentVersionId;
  const versions = parsed.versions && parsed.versions.length > 0
    ? normalizeRotationVersions(parsed.versions)
    : Object.freeze([
      Object.freeze({
        versionId: currentVersionId,
        state: SecurityMaterialRotationVersionStates.active,
        effectiveFrom: fallbackUpdatedAt,
      }),
    ]);

  return Object.freeze({
    currentVersionId,
    previousVersionId: normalizeOptional(parsed.previousVersionId),
    pendingVersionId: normalizeOptional(parsed.pendingVersionId),
    effectiveAsOf: normalizeOptional(parsed.effectiveAsOf) ?? fallbackUpdatedAt,
    versions,
    policy: normalizeRotationPolicyMetadata(parsed.policy),
  });
}

function normalizeRotationVersions(
  versions: ReadonlyArray<Partial<SecurityMaterialRotationVersionContract>>,
): ReadonlyArray<SecurityMaterialRotationVersionContract> {
  const normalized: SecurityMaterialRotationVersionContract[] = [];
  for (const version of versions) {
    const versionId = normalizeOptional(version.versionId);
    const effectiveFrom = normalizeOptional(version.effectiveFrom);
    if (!versionId || !effectiveFrom) {
      continue;
    }
    const isKnownState = typeof version.state === "string"
      && Object.values(SecurityMaterialRotationVersionStates).includes(version.state as typeof SecurityMaterialRotationVersionStates[keyof typeof SecurityMaterialRotationVersionStates]);
    const state = isKnownState
      ? version.state as typeof SecurityMaterialRotationVersionStates[keyof typeof SecurityMaterialRotationVersionStates]
      : SecurityMaterialRotationVersionStates.previous;

    normalized.push(Object.freeze({
      versionId,
      state,
      effectiveFrom,
      effectiveUntil: normalizeOptional(version.effectiveUntil),
      predecessorVersionId: normalizeOptional(version.predecessorVersionId),
      successorVersionId: normalizeOptional(version.successorVersionId),
    }));
  }

  if (normalized.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(normalized);
}

function normalizeRotationPolicyMetadata(policy: unknown): SecurityMaterialRotationPolicyMetadata | undefined {
  if (!policy || typeof policy !== "object") {
    return undefined;
  }
  const parsed = policy as Partial<SecurityMaterialRotationPolicyMetadata>;
  if (!parsed.rotationMode || !Object.values(SecurityMaterialRotationPolicyModes).includes(parsed.rotationMode)) {
    return undefined;
  }

  return Object.freeze({
    rotationMode: parsed.rotationMode,
    cutoverStrategy: parsed.cutoverStrategy,
    rotationIntervalDays: parsed.rotationIntervalDays,
    pendingActivationWindowDays: parsed.pendingActivationWindowDays,
    maxActiveOverlapMinutes: parsed.maxActiveOverlapMinutes,
    lastRotatedAt: normalizeOptional(parsed.lastRotatedAt),
    nextRotationDueAt: normalizeOptional(parsed.nextRotationDueAt),
  });
}
