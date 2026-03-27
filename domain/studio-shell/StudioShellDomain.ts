import type { AssetContractDescriptor } from "../contracts/AssetContract";
import { createAssetContractDescriptor } from "../contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import { createCompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";

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
}

export interface AssetDraft {
  readonly id: string;
  readonly studioId: string;
  readonly sessionId: string;
  readonly content: string;
  readonly metadata: AssetMetadata;
  readonly revision: number;
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
  return Object.freeze({
    title: normalizeRequired(input.title, "Asset metadata title"),
    summary: normalizeOptional(input.summary),
    tags: normalizeTags(input.tags),
    taxonomy: input.taxonomy ? createCompositionTaxonomyDescriptor(input.taxonomy) : undefined,
    contract: input.contract ? createAssetContractDescriptor(input.contract) : undefined,
  });
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
  readonly studioId: string;
  readonly session: AssetSession;
  readonly content: string;
  readonly metadata: AssetMetadata;
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
    studioId,
    sessionId: input.session.id,
    content: input.content,
    metadata: normalizeAssetMetadata(input.metadata),
    revision: 1,
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
    readonly now?: Date;
  },
): AssetDraft {
  assertSessionMutable(session);
  if (session.id !== draft.sessionId) {
    throw new Error(`Asset draft '${draft.id}' does not belong to session '${session.id}'.`);
  }

  return Object.freeze({
    ...draft,
    content: changes.content ?? draft.content,
    metadata: changes.metadata ? normalizeAssetMetadata(changes.metadata) : draft.metadata,
    revision: draft.revision + 1,
    updatedAt: (changes.now ?? new Date()).toISOString(),
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
