import { AssetId } from "../assets/AssetId";
import {
  ExchangeBundleFormatVersion,
  ExchangeBundleId,
  ExchangeBundleSubjectKinds,
  type ExchangeBundleSubjectKind,
  type ExchangeBundleProvenance,
} from "./ExchangeBundleDomain";

export class PublishablePackageId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): PublishablePackageId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("PublishablePackageId cannot be empty.");
    }
    return new PublishablePackageId(normalized);
  }
}

export const PublishablePackageStatuses = Object.freeze({
  draft: "draft",
  ready: "ready",
  published: "published",
  archived: "archived",
});

export type PublishablePackageStatus =
  typeof PublishablePackageStatuses[keyof typeof PublishablePackageStatuses];

export interface PublishablePackageReadiness {
  readonly isReady: boolean;
  readonly checkedAt: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly validationIssueCount: number;
}

export interface PublishablePackageMetadata {
  readonly label?: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly curatedBy?: string;
  readonly curatedAt?: string;
  readonly packageHint?: string;
  readonly capabilityHints: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
}

export interface PublishablePackageSourceReference {
  readonly bundleId: ExchangeBundleId;
  readonly bundleFormatVersion: ExchangeBundleFormatVersion;
  readonly rootSubject: Readonly<{
    readonly kind: ExchangeBundleSubjectKind;
    readonly assetId: string;
    readonly versionId: string;
  }>;
  readonly dependencySnapshotVersion?: string;
  readonly deterministicInputKey?: string;
}

export interface PublishablePackageProvenance {
  readonly origin: "curated" | "imported" | "automation";
  readonly sourceBundleProvenance?: ExchangeBundleProvenance;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PublishablePackage {
  readonly packageId: PublishablePackageId;
  readonly source: PublishablePackageSourceReference;
  readonly status: PublishablePackageStatus;
  readonly readiness: PublishablePackageReadiness;
  readonly metadata: PublishablePackageMetadata;
  readonly provenance: PublishablePackageProvenance;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly scope: {
    readonly excludesRuntimeState: true;
    readonly excludesDeploymentState: true;
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
    .sort((left, right) => left.localeCompare(right)));
}

function normalizeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(record)) as Record<string, unknown>);
}

function normalizeSubjectKind(value: ExchangeBundleSubjectKind): ExchangeBundleSubjectKind {
  if (!Object.values(ExchangeBundleSubjectKinds).includes(value)) {
    throw new Error(`Unsupported publishable package root subject kind '${value}'.`);
  }
  return value;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeReadiness(input?: Partial<PublishablePackageReadiness>): PublishablePackageReadiness {
  const checkedAt = normalizeOptional(input?.checkedAt) ?? new Date().toISOString();
  const reasonCodes = normalizeStringArray(input?.reasonCodes);
  const validationIssueCount = Math.max(0, Math.floor(input?.validationIssueCount ?? reasonCodes.length));
  const isReady = Boolean(input?.isReady);

  if (isReady && validationIssueCount > 0) {
    throw new Error("Publishable package cannot be marked ready when validationIssueCount is greater than 0.");
  }

  return Object.freeze({
    isReady,
    checkedAt,
    reasonCodes,
    validationIssueCount,
  });
}

function normalizeStatus(status: PublishablePackageStatus, readiness: PublishablePackageReadiness): PublishablePackageStatus {
  if (status === PublishablePackageStatuses.ready && !readiness.isReady) {
    throw new Error("Publishable package status 'ready' requires readiness.isReady=true.");
  }

  if (status === PublishablePackageStatuses.published && !readiness.isReady) {
    throw new Error("Publishable package status 'published' requires readiness.isReady=true.");
  }

  return status;
}

export function createPublishablePackage(input: {
  readonly packageId: string;
  readonly source: {
    readonly bundleId: string;
    readonly bundleFormatVersion?: string;
    readonly rootSubject: {
      readonly kind: ExchangeBundleSubjectKind;
      readonly assetId: string;
      readonly versionId: string;
    };
    readonly dependencySnapshotVersion?: string;
    readonly deterministicInputKey?: string;
  };
  readonly status?: PublishablePackageStatus;
  readonly readiness?: Partial<PublishablePackageReadiness>;
  readonly metadata?: Partial<PublishablePackageMetadata>;
  readonly provenance?: Partial<PublishablePackageProvenance>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}): PublishablePackage {
  const readiness = normalizeReadiness(input.readiness);
  const status = normalizeStatus(input.status ?? PublishablePackageStatuses.draft, readiness);
  const createdAt = normalizeOptional(input.createdAt) ?? new Date().toISOString();
  const updatedAt = normalizeOptional(input.updatedAt) ?? createdAt;

  return Object.freeze({
    packageId: PublishablePackageId.from(input.packageId),
    source: Object.freeze({
      bundleId: ExchangeBundleId.from(input.source.bundleId),
      bundleFormatVersion: ExchangeBundleFormatVersion.from(input.source.bundleFormatVersion),
      rootSubject: Object.freeze({
        kind: normalizeSubjectKind(input.source.rootSubject.kind),
        assetId: AssetId.from(input.source.rootSubject.assetId).value,
        versionId: normalizeRequired(input.source.rootSubject.versionId, "Publishable package root subject version id"),
      }),
      dependencySnapshotVersion: normalizeOptional(input.source.dependencySnapshotVersion),
      deterministicInputKey: normalizeOptional(input.source.deterministicInputKey),
    }),
    status,
    readiness,
    metadata: Object.freeze({
      label: normalizeOptional(input.metadata?.label),
      summary: normalizeOptional(input.metadata?.summary),
      tags: normalizeStringArray(input.metadata?.tags),
      curatedBy: normalizeOptional(input.metadata?.curatedBy),
      curatedAt: normalizeOptional(input.metadata?.curatedAt),
      packageHint: normalizeOptional(input.metadata?.packageHint),
      capabilityHints: normalizeStringArray(input.metadata?.capabilityHints),
      configurationHints: normalizeRecord(input.metadata?.configurationHints),
    }),
    provenance: Object.freeze({
      origin: input.provenance?.origin ?? "curated",
      sourceBundleProvenance: input.provenance?.sourceBundleProvenance
        ? Object.freeze({
          originType: input.provenance.sourceBundleProvenance.originType,
          sourceBundleId: normalizeOptional(input.provenance.sourceBundleProvenance.sourceBundleId),
          sourceVersionLineage: normalizeStringArray(input.provenance.sourceBundleProvenance.sourceVersionLineage),
          handoffSessionId: normalizeOptional(input.provenance.sourceBundleProvenance.handoffSessionId),
          metadata: normalizeRecord(input.provenance.sourceBundleProvenance.metadata),
        })
        : undefined,
      metadata: normalizeRecord(input.provenance?.metadata),
    }),
    createdAt,
    updatedAt,
    scope: Object.freeze({
      excludesRuntimeState: true,
      excludesDeploymentState: true,
    }),
  });
}

export function withPublishablePackageStatus(input: {
  readonly existing: PublishablePackage;
  readonly status: PublishablePackageStatus;
  readonly readiness?: Partial<PublishablePackageReadiness>;
  readonly updatedAt?: string;
}): PublishablePackage {
  const readiness = input.readiness
    ? normalizeReadiness(input.readiness)
    : input.existing.readiness;
  const status = normalizeStatus(input.status, readiness);

  return Object.freeze({
    ...input.existing,
    status,
    readiness,
    updatedAt: normalizeOptional(input.updatedAt) ?? new Date().toISOString(),
  });
}
