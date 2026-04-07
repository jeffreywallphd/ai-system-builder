import type { AssetContractDescriptor } from "../contracts/AssetContract";
import { createAssetContractDescriptor } from "../contracts/AssetContract";
import { AssetLineageRelationshipType } from "../assets/AssetLineageEdge";
import { AssetVersion } from "../assets/AssetVersion";
import type { AssetSourceType } from "../../../domain/assets/interfaces/IAsset";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import { assertAllowedCompositionTaxonomyCombination, createCompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";

export class StudioShellDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioShellDomainError";
  }
}

export class StudioShellDraftLifecycleTransitionError extends StudioShellDomainError {
  constructor(fromStatus: AssetDraftLifecycleStatus, toStatus: AssetDraftLifecycleStatus) {
    super(`Asset draft lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "StudioShellDraftLifecycleTransitionError";
  }
}

export class StudioShellDraftLifecyclePublishGateError extends StudioShellDomainError {
  constructor(status: AssetDraftLifecycleStatus) {
    super(`Asset draft lifecycle status '${status}' is not publish-ready.`);
    this.name = "StudioShellDraftLifecyclePublishGateError";
  }
}

export const StudioLifecycleStatuses = Object.freeze({
  draft: "draft",
  active: "active",
  archived: "archived",
});

export type StudioLifecycleStatus = typeof StudioLifecycleStatuses[keyof typeof StudioLifecycleStatuses];

export const AssetSessionStatuses = Object.freeze({
  active: "active",
  paused: "paused",
  closed: "closed",
});

export type AssetSessionStatus = typeof AssetSessionStatuses[keyof typeof AssetSessionStatuses];

export const AssetDraftLifecycleStatuses = Object.freeze({
  draft: "draft",
  validated: "validated",
  published: "published",
});

export type AssetDraftLifecycleStatus = typeof AssetDraftLifecycleStatuses[keyof typeof AssetDraftLifecycleStatuses];

export interface Studio {
  readonly id: string;
  readonly name: string;
  readonly status: StudioLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activeSessionId?: string;
}

export interface AssetMetadata {
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly provenance?: AssetProvenance;
}

export interface AssetMetadataPatch {
  readonly title?: string;
  readonly summary?: string | null;
  readonly tags?: ReadonlyArray<string>;
  readonly taxonomy?: CompositionTaxonomyDescriptor | null;
  readonly contract?: AssetContractDescriptor | null;
  readonly provenance?: AssetProvenance | null;
}

export interface AssetDraftDependencyReference {
  readonly assetId: string;
  readonly versionId?: string;
}

export interface AssetProvenanceUpstreamReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relationship?: AssetLineageRelationshipType;
}

export interface AssetProvenance {
  readonly creatorId?: string;
  readonly sourceType?: AssetSourceType;
  readonly sourceLabel?: string;
  readonly derivationContext?: string;
  readonly upstreamAssets?: ReadonlyArray<AssetProvenanceUpstreamReference>;
}

const AllowedAssetSourceTypes: ReadonlySet<AssetSourceType> = new Set([
  "generated",
  "uploaded",
  "imported",
  "derived",
  "system",
  "external",
  "unknown",
]);

export interface AssetDraft {
  readonly id: string;
  readonly assetId: string;
  readonly studioId: string;
  readonly sessionId: string;
  readonly content: string;
  readonly metadata: AssetMetadata;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly lifecycleStatus: AssetDraftLifecycleStatus;
  readonly revision: number;
  readonly publishedVersionIds: ReadonlyArray<string>;
  readonly lastPublishedVersionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetSession {
  readonly id: string;
  readonly studioId: string;
  readonly status: AssetSessionStatus;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly closedAt?: string;
  readonly currentDraftId?: string;
  readonly draftIds: ReadonlyArray<string>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

function normalizeAssetId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeAssetDraftDependencies(
  dependencies?: ReadonlyArray<AssetDraftDependencyReference>,
): ReadonlyArray<AssetDraftDependencyReference> {
  const deduped = new Map<string, AssetDraftDependencyReference>();
  for (const entry of dependencies ?? []) {
    const assetId = normalizeAssetId(entry.assetId, "Asset draft dependency asset id");
    const versionId = normalizeOptional(entry.versionId);
    deduped.set(`${assetId}::${versionId ?? ""}`, Object.freeze({ assetId, versionId }));
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeProvenanceUpstreamReferences(
  references?: ReadonlyArray<AssetProvenanceUpstreamReference>,
): ReadonlyArray<AssetProvenanceUpstreamReference> | undefined {
  const deduped = new Map<string, AssetProvenanceUpstreamReference>();
  for (const entry of references ?? []) {
    const assetId = normalizeAssetId(entry.assetId, "Asset provenance upstream asset id");
    const versionId = normalizeOptional(entry.versionId);
    const relationship = entry.relationship
      ? AssetLineageRelationshipType[entry.relationship]
        ? entry.relationship
        : undefined
      : undefined;
    if (entry.relationship && !relationship) {
      throw new Error(`Asset provenance upstream relationship '${entry.relationship}' is not supported.`);
    }

    const dedupeKey = `${assetId}::${versionId ?? ""}::${relationship ?? ""}`;
    deduped.set(dedupeKey, Object.freeze({ assetId, versionId, relationship }));
  }

  if (deduped.size === 0) {
    return undefined;
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeAssetProvenance(input?: AssetProvenance): AssetProvenance | undefined {
  if (!input) {
    return undefined;
  }

  const creatorId = normalizeOptional(input.creatorId);
  const sourceType = normalizeOptional(input.sourceType);
  if (sourceType && !AllowedAssetSourceTypes.has(sourceType as AssetSourceType)) {
    throw new Error(`Asset provenance sourceType '${sourceType}' is not supported.`);
  }
  const sourceLabel = normalizeOptional(input.sourceLabel);
  const derivationContext = normalizeOptional(input.derivationContext);
  const upstreamAssets = normalizeProvenanceUpstreamReferences(input.upstreamAssets);
  const hasEntries = creatorId || sourceType || sourceLabel || derivationContext || (upstreamAssets && upstreamAssets.length > 0);
  if (!hasEntries) {
    return undefined;
  }

  return Object.freeze({
    creatorId,
    sourceType: sourceType as AssetSourceType | undefined,
    sourceLabel,
    derivationContext,
    upstreamAssets,
  });
}

function assertLifecycleTransitionAllowed(fromStatus: AssetDraftLifecycleStatus, toStatus: AssetDraftLifecycleStatus): void {
  if (fromStatus === toStatus) {
    return;
  }

  if (
    (fromStatus === AssetDraftLifecycleStatuses.draft && toStatus === AssetDraftLifecycleStatuses.validated)
    || (fromStatus === AssetDraftLifecycleStatuses.validated && toStatus === AssetDraftLifecycleStatuses.draft)
    || (fromStatus === AssetDraftLifecycleStatuses.validated && toStatus === AssetDraftLifecycleStatuses.published)
    || (fromStatus === AssetDraftLifecycleStatuses.published && toStatus === AssetDraftLifecycleStatuses.draft)
  ) {
    return;
  }

  throw new StudioShellDraftLifecycleTransitionError(fromStatus, toStatus);
}

export function createStudio(input: {
  readonly id: string;
  readonly name: string;
  readonly status?: StudioLifecycleStatus;
  readonly now?: Date;
}): Studio {
  const id = normalizeRequired(input.id, "Studio id");
  const name = normalizeRequired(input.name, "Studio name");
  const status = input.status ?? StudioLifecycleStatuses.active;
  if (!Object.values(StudioLifecycleStatuses).includes(status)) {
    throw new Error("Studio status must be draft, active, or archived.");
  }
  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    name,
    status,
    createdAt: now,
    updatedAt: now,
    activeSessionId: undefined,
  });
}

export function withStudioSession(studio: Studio, sessionId: string, now: Date = new Date()): Studio {
  const normalizedSessionId = normalizeRequired(sessionId, "Studio active session id");
  if (studio.status === StudioLifecycleStatuses.archived) {
    throw new Error("Archived studios cannot activate sessions.");
  }

  return Object.freeze({
    ...studio,
    status: StudioLifecycleStatuses.active,
    activeSessionId: normalizedSessionId,
    updatedAt: now.toISOString(),
  });
}

export function normalizeAssetMetadata(input: AssetMetadata): AssetMetadata {
  const taxonomy = input.taxonomy ? createCompositionTaxonomyDescriptor(input.taxonomy) : undefined;
  if (taxonomy) {
    assertAllowedCompositionTaxonomyCombination(taxonomy, "Asset metadata taxonomy");
  }

  return Object.freeze({
    title: normalizeRequired(input.title, "Asset metadata title"),
    summary: normalizeOptional(input.summary),
    tags: normalizeTags(input.tags),
    taxonomy,
    contract: input.contract ? createAssetContractDescriptor(input.contract) : undefined,
    provenance: normalizeAssetProvenance(input.provenance),
  });
}

export function applyAssetMetadataPatch(metadata: AssetMetadata, patch: AssetMetadataPatch): AssetMetadata {
  const next: AssetMetadata = {
    title: patch.title ?? metadata.title,
    summary: patch.summary === null ? undefined : (patch.summary ?? metadata.summary),
    tags: patch.tags ?? metadata.tags,
    taxonomy: patch.taxonomy === null ? undefined : (patch.taxonomy ?? metadata.taxonomy),
    contract: patch.contract === null ? undefined : (patch.contract ?? metadata.contract),
    provenance: patch.provenance === null ? undefined : (patch.provenance ?? metadata.provenance),
  };

  return normalizeAssetMetadata(next);
}

export function createAssetSession(input: {
  readonly id: string;
  readonly studioId: string;
  readonly status?: AssetSessionStatus;
  readonly now?: Date;
}): AssetSession {
  const id = normalizeRequired(input.id, "Asset session id");
  const studioId = normalizeRequired(input.studioId, "Asset session studio id");
  const status = input.status ?? AssetSessionStatuses.active;
  if (!Object.values(AssetSessionStatuses).includes(status)) {
    throw new Error("Asset session status must be active, paused, or closed.");
  }
  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    studioId,
    status,
    openedAt: now,
    updatedAt: now,
    closedAt: status === AssetSessionStatuses.closed ? now : undefined,
    currentDraftId: undefined,
    draftIds: Object.freeze([]),
  });
}

export function closeAssetSession(session: AssetSession, now: Date = new Date()): AssetSession {
  if (session.status === AssetSessionStatuses.closed) {
    return session;
  }

  return Object.freeze({
    ...session,
    status: AssetSessionStatuses.closed,
    closedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

function assertSessionMutable(session: AssetSession): void {
  if (session.status === AssetSessionStatuses.closed) {
    throw new Error(`Asset session '${session.id}' is closed and cannot be mutated.`);
  }
}

export function createAssetDraft(input: {
  readonly id: string;
  readonly assetId?: string;
  readonly studioId: string;
  readonly session: AssetSession;
  readonly content: string;
  readonly metadata: AssetMetadata;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
  readonly now?: Date;
}): AssetDraft {
  const id = normalizeRequired(input.id, "Asset draft id");
  const studioId = normalizeRequired(input.studioId, "Asset draft studio id");
  assertSessionMutable(input.session);
  if (input.session.studioId !== studioId) {
    throw new Error("Asset draft studio id must match session studio id.");
  }

  const now = (input.now ?? new Date()).toISOString();
  return Object.freeze({
    id,
    assetId: normalizeAssetId(input.assetId ?? `studio-asset:${id}`, "Asset draft asset id"),
    studioId,
    sessionId: input.session.id,
    content: input.content,
    metadata: normalizeAssetMetadata(input.metadata),
    dependencies: normalizeAssetDraftDependencies(input.dependencies),
    lifecycleStatus: AssetDraftLifecycleStatuses.draft,
    revision: 1,
    publishedVersionIds: Object.freeze([]),
    lastPublishedVersionId: undefined,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAssetDraft(
  draft: AssetDraft,
  session: AssetSession,
  changes: {
    readonly content?: string;
    readonly metadata?: AssetMetadata;
    readonly metadataPatch?: AssetMetadataPatch;
    readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
    readonly now?: Date;
  },
): AssetDraft {
  assertSessionMutable(session);
  if (session.id !== draft.sessionId) {
    throw new Error(`Asset draft '${draft.id}' does not belong to session '${session.id}'.`);
  }
  if (changes.metadata && changes.metadataPatch) {
    throw new Error("Asset draft updates cannot include both full metadata and metadata patch.");
  }

  const metadata = changes.metadata
    ? normalizeAssetMetadata(changes.metadata)
    : changes.metadataPatch
      ? applyAssetMetadataPatch(draft.metadata, changes.metadataPatch)
      : draft.metadata;

  return Object.freeze({
    ...draft,
    content: changes.content ?? draft.content,
    metadata,
    dependencies: changes.dependencies ? normalizeAssetDraftDependencies(changes.dependencies) : draft.dependencies,
    lifecycleStatus: AssetDraftLifecycleStatuses.draft,
    revision: draft.revision + 1,
    updatedAt: (changes.now ?? new Date()).toISOString(),
  });
}

export function transitionAssetDraftLifecycle(
  draft: AssetDraft,
  session: AssetSession,
  targetStatus: AssetDraftLifecycleStatus,
  now: Date = new Date(),
): AssetDraft {
  assertSessionMutable(session);
  if (session.id !== draft.sessionId) {
    throw new Error(`Asset draft '${draft.id}' does not belong to session '${session.id}'.`);
  }

  assertLifecycleTransitionAllowed(draft.lifecycleStatus, targetStatus);
  if (draft.lifecycleStatus === targetStatus) {
    return draft;
  }

  return Object.freeze({
    ...draft,
    lifecycleStatus: targetStatus,
    updatedAt: now.toISOString(),
  });
}

export function publishAssetDraftVersion(input: {
  readonly draft: AssetDraft;
  readonly session: AssetSession;
  readonly versionId: string;
  readonly versionLabel?: string;
  readonly parentVersionId?: string;
  readonly createdBy?: string;
  readonly upstreamVersionIds?: ReadonlyArray<string>;
  readonly now?: Date;
}): {
  readonly draft: AssetDraft;
  readonly version: AssetVersion;
} {
  assertSessionMutable(input.session);
  if (input.session.id !== input.draft.sessionId) {
    throw new Error(`Asset draft '${input.draft.id}' does not belong to session '${input.session.id}'.`);
  }

  if (input.draft.lifecycleStatus !== AssetDraftLifecycleStatuses.validated) {
    throw new StudioShellDraftLifecyclePublishGateError(input.draft.lifecycleStatus);
  }

  const versionId = normalizeRequired(input.versionId, "Asset version id");
  if (input.draft.publishedVersionIds.includes(versionId)) {
    throw new Error(`Asset version '${versionId}' is already published for draft '${input.draft.id}'.`);
  }

  const provenanceUpstreamVersionIds = (input.draft.metadata.provenance?.upstreamAssets ?? [])
    .map((entry) => normalizeOptional(entry.versionId))
    .filter((entry): entry is string => !!entry);
  const dependencyVersionIds = input.draft.dependencies
    .map((entry) => normalizeOptional(entry.versionId))
    .filter((entry): entry is string => !!entry);
  const upstreamVersionIds = [...new Set([...(input.upstreamVersionIds ?? []), ...provenanceUpstreamVersionIds, ...dependencyVersionIds])];
  const parentVersionId = normalizeOptional(input.parentVersionId) ?? input.draft.lastPublishedVersionId;
  const createdBy = normalizeOptional(input.createdBy) ?? input.draft.metadata.provenance?.creatorId;
  const now = input.now ?? new Date();

  const version = new AssetVersion({
    assetId: input.draft.assetId,
    versionId,
    versionLabel: input.versionLabel,
    parentVersionId,
    createdBy,
    createdAt: now,
    upstreamVersionIds,
    metadata: {
      studioId: input.draft.studioId,
      sessionId: input.draft.sessionId,
      draftId: input.draft.id,
      draftRevision: input.draft.revision,
      metadata: input.draft.metadata,
      dependencies: input.draft.dependencies,
      lifecycleStatus: input.draft.lifecycleStatus,
    },
  });

  const draft = Object.freeze({
    ...input.draft,
    lifecycleStatus: AssetDraftLifecycleStatuses.published,
    publishedVersionIds: Object.freeze([...input.draft.publishedVersionIds, version.versionId]),
    lastPublishedVersionId: version.versionId,
    updatedAt: now.toISOString(),
  });

  return Object.freeze({
    draft,
    version,
  });
}

export function attachDraftToSession(session: AssetSession, draft: AssetDraft, now: Date = new Date()): AssetSession {
  assertSessionMutable(session);
  if (session.id !== draft.sessionId) {
    throw new Error(`Asset draft '${draft.id}' does not belong to session '${session.id}'.`);
  }

  const nextDraftIds = session.draftIds.includes(draft.id)
    ? session.draftIds
    : Object.freeze([...session.draftIds, draft.id]);

  return Object.freeze({
    ...session,
    draftIds: nextDraftIds,
    currentDraftId: draft.id,
    updatedAt: now.toISOString(),
  });
}
