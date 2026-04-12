import type { StudioHandoffActorContext } from "./StudioHandoffContext";
import type { StudioHandoffAssetRole } from "./StudioHandoffContract";

export const StudioHandoffAuditEventKinds = Object.freeze({
  handoffCreated: "handoff-created",
  compatibilityEvaluated: "handoff-compatibility-evaluated",
  handoffOrchestrated: "handoff-orchestrated",
  handoffUpdated: "handoff-updated",
  handoffFailed: "handoff-failed",
});

export type StudioHandoffAuditEventKind =
  typeof StudioHandoffAuditEventKinds[keyof typeof StudioHandoffAuditEventKinds];

export const StudioHandoffAuditOutcomes = Object.freeze({
  accepted: "accepted",
  succeeded: "succeeded",
  rejected: "rejected",
  failed: "failed",
});

export type StudioHandoffAuditOutcome = typeof StudioHandoffAuditOutcomes[keyof typeof StudioHandoffAuditOutcomes];

export interface StudioHandoffAuditAssetReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly role?: StudioHandoffAssetRole | string;
}

export interface StudioHandoffAuditRecord {
  readonly auditId: string;
  readonly occurredAt: string;
  readonly eventKind: StudioHandoffAuditEventKind;
  readonly outcome: StudioHandoffAuditOutcome;
  readonly handoff: {
    readonly handoffId: string;
    readonly revisionId?: string;
    readonly previousHandoffId?: string;
  };
  readonly actor?: {
    readonly actorKind: StudioHandoffActorContext["actorKind"];
    readonly actorId?: string;
    readonly actorLabel?: string;
    readonly requestSource?: string;
  };
  readonly sourceStudio: {
    readonly studioId: string;
    readonly studioType: string;
  };
  readonly targetStudio: {
    readonly studioId: string;
    readonly studioType: string;
  };
  readonly assets: ReadonlyArray<StudioHandoffAuditAssetReference>;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly detail?: {
    readonly statusCode?: string;
    readonly message?: string;
    readonly issueCodes?: ReadonlyArray<string>;
    readonly matchedContractId?: string;
    readonly targetInputKind?: string;
    readonly compatibilityPassed?: boolean;
  };
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

function normalizeAssets(input: ReadonlyArray<StudioHandoffAuditAssetReference>): ReadonlyArray<StudioHandoffAuditAssetReference> {
  if (input.length === 0) {
    throw new Error("Studio handoff audit record requires at least one pinned asset reference.");
  }

  return Object.freeze(input.map((entry) => Object.freeze({
    assetId: normalizeRequired(entry.assetId, "Studio handoff audit assetId"),
    versionId: normalizeRequired(entry.versionId, "Studio handoff audit versionId"),
    role: normalizeOptional(entry.role),
  })));
}

export function createStudioHandoffAuditRecord(input: Omit<StudioHandoffAuditRecord, "auditId" | "occurredAt"> & {
  readonly auditId?: string;
  readonly occurredAt?: string;
}): StudioHandoffAuditRecord {
  const occurredAt = normalizeOptional(input.occurredAt) ?? new Date().toISOString();
  const auditId = normalizeOptional(input.auditId)
    ?? `handoff-audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return Object.freeze({
    ...input,
    auditId,
    occurredAt,
    handoff: Object.freeze({
      handoffId: normalizeRequired(input.handoff.handoffId, "Studio handoff audit handoffId"),
      revisionId: normalizeOptional(input.handoff.revisionId),
      previousHandoffId: normalizeOptional(input.handoff.previousHandoffId),
    }),
    actor: input.actor
      ? Object.freeze({
        actorKind: input.actor.actorKind,
        actorId: normalizeOptional(input.actor.actorId),
        actorLabel: normalizeOptional(input.actor.actorLabel),
        requestSource: normalizeOptional(input.actor.requestSource),
      })
      : undefined,
    sourceStudio: Object.freeze({
      studioId: normalizeRequired(input.sourceStudio.studioId, "Studio handoff audit source studio id"),
      studioType: normalizeRequired(input.sourceStudio.studioType, "Studio handoff audit source studio type"),
    }),
    targetStudio: Object.freeze({
      studioId: normalizeRequired(input.targetStudio.studioId, "Studio handoff audit target studio id"),
      studioType: normalizeRequired(input.targetStudio.studioType, "Studio handoff audit target studio type"),
    }),
    assets: normalizeAssets(input.assets),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    detail: input.detail
      ? Object.freeze({
        statusCode: normalizeOptional(input.detail.statusCode),
        message: normalizeOptional(input.detail.message),
        issueCodes: input.detail.issueCodes
          ? Object.freeze(input.detail.issueCodes.map((entry) => entry.trim()).filter(Boolean))
          : undefined,
        matchedContractId: normalizeOptional(input.detail.matchedContractId),
        targetInputKind: normalizeOptional(input.detail.targetInputKind),
        compatibilityPassed: input.detail.compatibilityPassed,
      })
      : undefined,
  });
}
