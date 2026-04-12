import { createHash } from "node:crypto";
import {
  type OfflineResourceClass,
  type OfflineResourcePolicyEvaluationInput,
  OfflineAuthorityScopes,
  OfflineStorageRules,
  resolveOfflineResourceAuthorityBoundary,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { classifyOfflineResourceLocalModePolicy } from "./OfflineResourceClassificationPolicy";

export class OfflineAuthoritativeSnapshotCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineAuthoritativeSnapshotCacheError";
  }
}

export const OfflineSnapshotCacheProtectionPostures = Object.freeze({
  protectedAtRest: "protected-at-rest",
  unprotectedAtRest: "unprotected-at-rest",
});

export type OfflineSnapshotCacheProtectionPosture =
  typeof OfflineSnapshotCacheProtectionPostures[keyof typeof OfflineSnapshotCacheProtectionPostures];

export interface OfflineAuthoritativeSnapshotCacheKey {
  readonly workspaceId: string;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
}

export interface OfflineAuthoritativeSnapshotEligibilityMarkers {
  readonly workspaceVisibility: OfflineResourcePolicyEvaluationInput["workspaceVisibility"];
  readonly workspaceAccessRole: OfflineResourcePolicyEvaluationInput["workspaceAccessRole"];
  readonly workspaceSharingPosture: OfflineResourcePolicyEvaluationInput["workspaceSharingPosture"];
  readonly sensitivityMarking: OfflineResourcePolicyEvaluationInput["sensitivityMarking"];
  readonly storageRule: OfflineResourcePolicyEvaluationInput["storageRule"];
  readonly deviceTrustPosture: OfflineResourcePolicyEvaluationInput["deviceTrustPosture"];
  readonly exclusionReasons: ReadonlyArray<string>;
}

export interface OfflineAuthoritativeSnapshotRecord extends OfflineAuthoritativeSnapshotCacheKey {
  readonly authoritativeRevision: string;
  readonly authoritativeSnapshotRevision: string;
  readonly authorityScope: typeof OfflineAuthorityScopes.authoritativeServer;
  readonly storageBucket: string;
  readonly behaviorClass: string;
  readonly cachedAt: string;
  readonly lastSynchronizedAt: string;
  readonly expiresAt?: string;
  readonly cachedByActorUserIdentityId: string;
  readonly cacheProtectionPosture: OfflineSnapshotCacheProtectionPosture;
  readonly snapshotDigest: string;
  readonly eligibilityMarkers: OfflineAuthoritativeSnapshotEligibilityMarkers;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export interface CacheOfflineAuthoritativeSnapshotRequest {
  readonly workspaceId: string;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly authoritativeRevision: string;
  readonly authoritativeSnapshotRevision?: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly policy: OfflineResourcePolicyEvaluationInput;
  readonly cachedByActorUserIdentityId: string;
  readonly cachedAt?: string;
  readonly lastSynchronizedAt?: string;
  readonly expiresAt?: string;
}

export interface OfflineAuthoritativeSnapshotCacheRepositoryCapabilities {
  readonly supportsProtectedAtRestStorage: boolean;
  readonly maxEntries: number;
}

export interface IOfflineAuthoritativeSnapshotCacheRepository {
  getCapabilities(): OfflineAuthoritativeSnapshotCacheRepositoryCapabilities;
  upsertSnapshot(record: OfflineAuthoritativeSnapshotRecord): Promise<void>;
  findSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<OfflineAuthoritativeSnapshotRecord | undefined>;
  listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>>;
  deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineAuthoritativeSnapshotCacheError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineAuthoritativeSnapshotCacheError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function assertNoFilesystemReferences(value: unknown, fieldPath: string): void {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (
      normalized.startsWith("file://")
      || /^[a-zA-Z]:\\/.test(normalized)
      || normalized.startsWith("\\\\")
      || normalized.startsWith("/")
    ) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `${fieldPath} must remain a logical snapshot payload and cannot store filesystem references.`,
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoFilesystemReferences(entry, `${fieldPath}[${index}]`);
    });
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoFilesystemReferences(entry, `${fieldPath}.${key}`);
    }
  }
}

export function computeOfflineSnapshotDigest(snapshot: Readonly<Record<string, unknown>>): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export class OfflineAuthoritativeSnapshotCacheService {
  constructor(
    private readonly repository: IOfflineAuthoritativeSnapshotCacheRepository,
  ) {}

  public async cacheSnapshot(
    request: CacheOfflineAuthoritativeSnapshotRequest,
  ): Promise<OfflineAuthoritativeSnapshotRecord> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const resourceId = normalizeRequired(request.resourceId, "resourceId");
    const cachedByActorUserIdentityId = normalizeRequired(
      request.cachedByActorUserIdentityId,
      "cachedByActorUserIdentityId",
    );
    assertNoFilesystemReferences(request.snapshot, "snapshot");

    const boundary = resolveOfflineResourceAuthorityBoundary(request.resourceClass);
    if (boundary.authoritativeStateScope !== OfflineAuthorityScopes.authoritativeServer) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Resource class '${request.resourceClass}' is not server-authoritative and cannot be cached as authoritative snapshot.`,
      );
    }
    if (!boundary.offlineCapabilities.cache) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Resource class '${request.resourceClass}' does not allow offline cache snapshots.`,
      );
    }

    const policyEvaluation = classifyOfflineResourceLocalModePolicy({
      resourceClass: request.resourceClass,
      policy: request.policy,
    });
    if (!policyEvaluation.supportedResourceClass || !policyEvaluation.posture.cache.allowed) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Offline cache policy denied authoritative snapshot caching for '${request.resourceClass}'.`,
      );
    }

    const supportsProtectedStorage = this.repository.getCapabilities().supportsProtectedAtRestStorage;
    if (
      request.policy.storageRule === OfflineStorageRules.requireEncryptedOfflineCache
      && !supportsProtectedStorage
    ) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        "Offline cache policy requires protected-at-rest storage but this desktop cache store does not provide it.",
      );
    }

    const authoritativeRevision = normalizeRequired(request.authoritativeRevision, "authoritativeRevision");
    const authoritativeSnapshotRevision = normalizeRequired(
      request.authoritativeSnapshotRevision ?? authoritativeRevision,
      "authoritativeSnapshotRevision",
    );
    const cachedAt = normalizeIsoTimestamp(
      request.cachedAt ?? new Date().toISOString(),
      "cachedAt",
    );
    const lastSynchronizedAt = normalizeIsoTimestamp(
      request.lastSynchronizedAt ?? cachedAt,
      "lastSynchronizedAt",
    );
    const expiresAt = request.expiresAt ? normalizeIsoTimestamp(request.expiresAt, "expiresAt") : undefined;
    if (expiresAt && new Date(expiresAt).getTime() < new Date(cachedAt).getTime()) {
      throw new OfflineAuthoritativeSnapshotCacheError("expiresAt cannot be earlier than cachedAt.");
    }

    const resolvedBoundary = resolveOfflineResourceAuthorityBoundary(request.resourceClass);
    const record: OfflineAuthoritativeSnapshotRecord = Object.freeze({
      workspaceId,
      resourceClass: request.resourceClass,
      resourceId,
      authoritativeRevision,
      authoritativeSnapshotRevision,
      authorityScope: OfflineAuthorityScopes.authoritativeServer,
      storageBucket: resolvedBoundary.defaultStorageBucket,
      behaviorClass: resolvedBoundary.eligibility.behaviorClass,
      cachedAt,
      lastSynchronizedAt,
      expiresAt,
      cachedByActorUserIdentityId,
      cacheProtectionPosture: supportsProtectedStorage
        ? OfflineSnapshotCacheProtectionPostures.protectedAtRest
        : OfflineSnapshotCacheProtectionPostures.unprotectedAtRest,
      snapshotDigest: computeOfflineSnapshotDigest(request.snapshot),
      eligibilityMarkers: Object.freeze({
        workspaceVisibility: request.policy.workspaceVisibility,
        workspaceAccessRole: request.policy.workspaceAccessRole,
        workspaceSharingPosture: request.policy.workspaceSharingPosture,
        sensitivityMarking: request.policy.sensitivityMarking,
        storageRule: request.policy.storageRule,
        deviceTrustPosture: request.policy.deviceTrustPosture,
        exclusionReasons: Object.freeze([...policyEvaluation.exclusionReasons]),
      }),
      snapshot: Object.freeze({ ...request.snapshot }),
    });
    await this.repository.upsertSnapshot(record);
    return record;
  }

  public getSnapshot(
    key: OfflineAuthoritativeSnapshotCacheKey,
  ): Promise<OfflineAuthoritativeSnapshotRecord | undefined> {
    return this.repository.findSnapshot({
      workspaceId: normalizeRequired(key.workspaceId, "workspaceId"),
      resourceClass: key.resourceClass,
      resourceId: normalizeRequired(key.resourceId, "resourceId"),
    });
  }

  public listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>> {
    return this.repository.listWorkspaceSnapshots(normalizeRequired(workspaceId, "workspaceId"));
  }

  public deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean> {
    return this.repository.deleteSnapshot({
      workspaceId: normalizeRequired(key.workspaceId, "workspaceId"),
      resourceClass: key.resourceClass,
      resourceId: normalizeRequired(key.resourceId, "resourceId"),
    });
  }
}
