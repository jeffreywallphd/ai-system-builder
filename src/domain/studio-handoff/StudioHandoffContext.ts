import type { StudioHandoffIntent } from "./StudioHandoffContract";

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

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = values.map((entry) => entry.trim()).filter(Boolean);
  return Object.freeze(normalized);
}

function normalizeRecord(value?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze({ ...value });
}

export const StudioHandoffActorKinds = Object.freeze({
  user: "user",
  system: "system",
  automation: "automation",
  external: "external",
});

export type StudioHandoffActorKind =
  typeof StudioHandoffActorKinds[keyof typeof StudioHandoffActorKinds];

export interface StudioHandoffActorContext {
  readonly actorKind: StudioHandoffActorKind;
  readonly actorId?: string;
  readonly actorLabel?: string;
  readonly requestSource?: string;
}

export interface StudioHandoffPrefillContext {
  readonly values: Readonly<Record<string, unknown>>;
  readonly hintOnlyKeys?: ReadonlyArray<string>;
  readonly note?: string;
}

export interface StudioHandoffSourceReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly relation?: string;
  readonly studioId?: string;
  readonly studioType?: string;
}

export interface StudioHandoffProvenance {
  readonly correlationId?: string;
  readonly sourceSessionId?: string;
  readonly sourceDraftId?: string;
  readonly sourceVersionLineage?: ReadonlyArray<string>;
  readonly labels?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioHandoffContext {
  readonly domain: "studio-handoff-context";
  readonly sourceStudioId: string;
  readonly sourceStudioType: string;
  readonly targetStudioId: string;
  readonly targetStudioType: string;
  readonly intent: StudioHandoffIntent;
  readonly initiatedAt: string;
  readonly actor?: StudioHandoffActorContext;
  readonly prefill?: StudioHandoffPrefillContext;
  readonly sourceReferences: ReadonlyArray<StudioHandoffSourceReference>;
  readonly provenance?: StudioHandoffProvenance;
}

export interface StudioHandoffContextInput {
  readonly sourceStudioId: string;
  readonly sourceStudioType: string;
  readonly targetStudioId: string;
  readonly targetStudioType: string;
  readonly intent: StudioHandoffIntent;
  readonly initiatedAt?: Date;
  readonly actor?: StudioHandoffActorContext;
  readonly prefill?: StudioHandoffPrefillContext;
  readonly sourceReferences: ReadonlyArray<StudioHandoffSourceReference>;
  readonly provenance?: StudioHandoffProvenance;
}

function normalizeSourceReference(reference: StudioHandoffSourceReference): StudioHandoffSourceReference {
  return Object.freeze({
    assetId: normalizeRequired(reference.assetId, "Studio handoff source reference asset id"),
    versionId: normalizeRequired(reference.versionId, "Studio handoff source reference version id"),
    relation: normalizeOptional(reference.relation),
    studioId: normalizeOptional(reference.studioId),
    studioType: normalizeOptional(reference.studioType),
  });
}

export function createStudioHandoffContext(input: StudioHandoffContextInput): StudioHandoffContext {
  if (input.sourceReferences.length === 0) {
    throw new Error("Studio handoff context requires at least one source reference.");
  }

  if (input.actor && !Object.values(StudioHandoffActorKinds).includes(input.actor.actorKind)) {
    throw new Error(`Studio handoff actor kind '${input.actor.actorKind}' is not supported.`);
  }

  return Object.freeze({
    domain: "studio-handoff-context",
    sourceStudioId: normalizeRequired(input.sourceStudioId, "Studio handoff context source studio id"),
    sourceStudioType: normalizeRequired(input.sourceStudioType, "Studio handoff context source studio type"),
    targetStudioId: normalizeRequired(input.targetStudioId, "Studio handoff context target studio id"),
    targetStudioType: normalizeRequired(input.targetStudioType, "Studio handoff context target studio type"),
    intent: Object.freeze({
      kind: input.intent.kind,
      description: normalizeOptional(input.intent.description),
      labels: Object.freeze([...(input.intent.labels ?? []).map((entry) => entry.trim()).filter(Boolean)]),
    }),
    initiatedAt: (input.initiatedAt ?? new Date()).toISOString(),
    actor: input.actor
      ? Object.freeze({
        actorKind: input.actor.actorKind,
        actorId: normalizeOptional(input.actor.actorId),
        actorLabel: normalizeOptional(input.actor.actorLabel),
        requestSource: normalizeOptional(input.actor.requestSource),
      })
      : undefined,
    prefill: input.prefill
      ? Object.freeze({
        values: normalizeRecord(input.prefill.values) ?? Object.freeze({}),
        hintOnlyKeys: normalizeStringArray(input.prefill.hintOnlyKeys),
        note: normalizeOptional(input.prefill.note),
      })
      : undefined,
    sourceReferences: Object.freeze(input.sourceReferences.map((entry) => normalizeSourceReference(entry))),
    provenance: input.provenance
      ? Object.freeze({
        correlationId: normalizeOptional(input.provenance.correlationId),
        sourceSessionId: normalizeOptional(input.provenance.sourceSessionId),
        sourceDraftId: normalizeOptional(input.provenance.sourceDraftId),
        sourceVersionLineage: normalizeStringArray(input.provenance.sourceVersionLineage),
        labels: normalizeStringArray(input.provenance.labels),
        metadata: normalizeRecord(input.provenance.metadata),
      })
      : undefined,
  });
}

export function listStudioHandoffPrefillKeys(context: StudioHandoffContext | undefined): ReadonlyArray<string> {
  if (!context?.prefill?.values) {
    return Object.freeze([]);
  }
  return Object.freeze(Object.keys(context.prefill.values));
}
