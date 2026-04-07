import type { StudioHandoffContract, StudioHandoffAssetRole } from "@domain/studio-handoff/StudioHandoffContract";
import {
  StudioHandoffAuditEventKinds,
  StudioHandoffAuditOutcomes,
} from "@domain/studio-handoff/StudioHandoffAuditTrail";
import type { StudioHandoffAuditTrailService } from "./StudioHandoffAuditTrailService";
import type { StudioHandoffContext, StudioHandoffSourceReference } from "@domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffDependencyRecord } from "./CrossStudioDependencyGraph";
import type { StudioHandoffLineageRecord } from "./StudioHandoffLineageTracker";
import type {
  StudioHandoffChangeSet,
  StudioHandoffPreparation,
  StudioHandoffRevision,
} from "./StudioHandoffOrchestrationService";
import type { StudioHandoffFailure } from "./StudioHandoffFailure";
import { HandoffBoundedCache } from "./HandoffBoundedCache";

export interface StudioHandoffRevisionRecord {
  readonly revisionId: string;
  readonly previousHandoffId: string;
  readonly updatedHandoffId: string;
  readonly createdAt: string;
  readonly changes?: StudioHandoffChangeSet;
}

export interface StudioHandoffRetryLinkRecord {
  readonly attemptKind: "retry" | "reconciliation";
  readonly decision: "retryable" | "reconcilable" | "terminal";
  readonly reasonCode: string;
  readonly reason: string;
  readonly sourceHandoffId: string;
  readonly targetHandoffId: string;
  readonly initiatedAt: string;
}

export interface PersistedStudioHandoffRecord {
  readonly handoffId: string;
  readonly sourceStudioId: string;
  readonly sourceStudioType: string;
  readonly targetStudioId: string;
  readonly targetStudioType: string;
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
  };
  readonly bundledAssets: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId: string;
    readonly role: StudioHandoffAssetRole | string;
  }>;
  readonly context: {
    readonly initiatedAt?: string;
    readonly intentKind: string;
    readonly correlationId?: string;
    readonly sourceReferences: ReadonlyArray<StudioHandoffSourceReference>;
    readonly prefillKeys: ReadonlyArray<string>;
  };
  readonly orchestration: {
    readonly status: "prepared" | "failed";
    readonly targetInputKind?: string;
    readonly matchedContractId?: string;
    readonly issueCodes: ReadonlyArray<string>;
  };
  readonly revision?: StudioHandoffRevisionRecord;
  readonly retryLink?: StudioHandoffRetryLinkRecord;
  readonly lineageRecordId?: string;
  readonly dependencyRecordId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudioHandoffRepository {
  saveRecord(record: PersistedStudioHandoffRecord): Promise<PersistedStudioHandoffRecord>;
  getRecordByHandoffId(handoffId: string): Promise<PersistedStudioHandoffRecord | undefined>;
  listRecordsBySourceStudio(sourceStudioId: string, limit?: number): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
  listRecordsByTargetStudio(targetStudioId: string, limit?: number): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
  listRecordsByAssetVersion(params: { assetId: string; versionId?: string; limit?: number }): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
}

function extractBundledAssets(handoff: StudioHandoffContract): ReadonlyArray<PersistedStudioHandoffRecord["bundledAssets"][number]> {
  if (!handoff.multiAsset) {
    return Object.freeze([{ role: "primary", assetId: handoff.payload.assetId, versionId: handoff.payload.versionId }]);
  }

  return Object.freeze(handoff.multiAsset.assets.map((entry) => Object.freeze({
    role: entry.role,
    assetId: entry.pinnedVersion?.assetId ?? entry.assetId,
    versionId: entry.pinnedVersion?.versionId ?? entry.versionId,
  })));
}

function toRecord(input: {
  readonly handoff: StudioHandoffContract;
  readonly context: StudioHandoffContext;
  readonly targetInputKind?: string;
  readonly matchedContractId?: string;
  readonly issueCodes?: ReadonlyArray<string>;
  readonly status: "prepared" | "failed";
  readonly revision?: StudioHandoffRevision;
  readonly changes?: StudioHandoffChangeSet;
  readonly retryLink?: StudioHandoffRetryLinkRecord;
  readonly lineage?: StudioHandoffLineageRecord;
  readonly dependency?: StudioHandoffDependencyRecord;
}): PersistedStudioHandoffRecord {
  const now = new Date().toISOString();
  return Object.freeze({
    handoffId: input.handoff.id.value,
    sourceStudioId: input.handoff.source.studioId,
    sourceStudioType: input.handoff.source.studioType,
    targetStudioId: input.handoff.target.studioId,
    targetStudioType: input.handoff.target.studioType,
    authoritativeAsset: Object.freeze({
      assetId: input.handoff.payload.pinnedVersion?.assetId ?? input.handoff.payload.assetId,
      versionId: input.handoff.payload.pinnedVersion?.versionId ?? input.handoff.payload.versionId,
    }),
    bundledAssets: extractBundledAssets(input.handoff),
    context: Object.freeze({
      initiatedAt: input.context.initiatedAt,
      intentKind: input.handoff.intent.kind,
      correlationId: input.context.provenance?.correlationId,
      sourceReferences: Object.freeze([...input.context.sourceReferences]),
      prefillKeys: Object.freeze(Object.keys(input.context.prefill?.values ?? {})),
    }),
    orchestration: Object.freeze({
      status: input.status,
      targetInputKind: input.targetInputKind,
      matchedContractId: input.matchedContractId,
      issueCodes: Object.freeze([...(input.issueCodes ?? [])]),
    }),
    revision: input.revision
      ? Object.freeze({
        revisionId: input.revision.revisionId,
        previousHandoffId: input.revision.previousHandoffId,
        updatedHandoffId: input.revision.updatedHandoffId,
        createdAt: input.revision.createdAt,
        changes: input.changes,
      })
      : undefined,
    retryLink: input.retryLink
      ? Object.freeze({
        attemptKind: input.retryLink.attemptKind,
        decision: input.retryLink.decision,
        reasonCode: input.retryLink.reasonCode,
        reason: input.retryLink.reason,
        sourceHandoffId: input.retryLink.sourceHandoffId,
        targetHandoffId: input.retryLink.targetHandoffId,
        initiatedAt: input.retryLink.initiatedAt,
      })
      : undefined,
    lineageRecordId: input.lineage?.recordId,
    dependencyRecordId: input.dependency?.recordId,
    createdAt: now,
    updatedAt: now,
  });
}

export class StudioHandoffPersistenceService {
  public constructor(
    private readonly repository: StudioHandoffRepository,
    private readonly auditTrail?: Pick<StudioHandoffAuditTrailService, "record">,
  ) {}

  public async persistPrepared(input: {
    readonly preparation: StudioHandoffPreparation;
    readonly revision?: StudioHandoffRevision;
    readonly changes?: StudioHandoffChangeSet;
    readonly retryLink?: StudioHandoffRetryLinkRecord;
    readonly lineage?: StudioHandoffLineageRecord;
    readonly dependency?: StudioHandoffDependencyRecord;
  }): Promise<PersistedStudioHandoffRecord> {
    const record = toRecord({
      handoff: input.preparation.handoff,
      context: input.preparation.context,
      status: "prepared",
      targetInputKind: input.preparation.targetInput.kind,
      matchedContractId: input.preparation.compatibility.matchedContractId,
      issueCodes: input.preparation.compatibility.issues.map((entry) => entry.code),
      revision: input.revision,
      changes: input.changes,
      retryLink: input.retryLink,
      lineage: input.lineage ?? input.preparation.lineage,
      dependency: input.dependency,
    });

    const persisted = await this.repository.saveRecord(record);
    this.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffOrchestrated,
      outcome: persisted.orchestration.status === "prepared" ? StudioHandoffAuditOutcomes.succeeded : StudioHandoffAuditOutcomes.failed,
      handoff: {
        handoffId: persisted.handoffId,
        revisionId: persisted.revision?.revisionId,
        previousHandoffId: persisted.revision?.previousHandoffId,
      },
      actor: input.preparation.context.actor,
      sourceStudio: { studioId: persisted.sourceStudioId, studioType: persisted.sourceStudioType },
      targetStudio: { studioId: persisted.targetStudioId, studioType: persisted.targetStudioType },
      assets: persisted.bundledAssets,
      detail: {
        statusCode: persisted.orchestration.status,
        issueCodes: persisted.orchestration.issueCodes,
        matchedContractId: persisted.orchestration.matchedContractId,
        targetInputKind: persisted.orchestration.targetInputKind,
        compatibilityPassed: persisted.orchestration.issueCodes.length === 0,
      },
    });
    return persisted;
  }

  public async persistFailure(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly failure: StudioHandoffFailure;
    readonly revision?: StudioHandoffRevision;
    readonly changes?: StudioHandoffChangeSet;
    readonly retryLink?: StudioHandoffRetryLinkRecord;
  }): Promise<PersistedStudioHandoffRecord> {
    const record = toRecord({
      handoff: input.handoff,
      context: input.context,
      status: "failed",
      issueCodes: [input.failure.code, ...input.failure.issues.map((entry) => entry.code)],
      revision: input.revision,
      changes: input.changes,
      retryLink: input.retryLink,
    });
    const persisted = await this.repository.saveRecord(record);
    this.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffFailed,
      outcome: StudioHandoffAuditOutcomes.failed,
      handoff: {
        handoffId: persisted.handoffId,
        revisionId: persisted.revision?.revisionId,
        previousHandoffId: persisted.revision?.previousHandoffId,
      },
      actor: input.context.actor,
      sourceStudio: { studioId: persisted.sourceStudioId, studioType: persisted.sourceStudioType },
      targetStudio: { studioId: persisted.targetStudioId, studioType: persisted.targetStudioType },
      assets: persisted.bundledAssets,
      detail: {
        statusCode: input.failure.code,
        message: input.failure.message,
        issueCodes: persisted.orchestration.issueCodes,
        compatibilityPassed: false,
      },
    });
    return persisted;
  }
}

export class StudioHandoffQueryService {
  private static readonly DEFAULT_LIST_LIMIT = 100;
  private static readonly MAX_LIST_LIMIT = 500;
  private readonly queryCache = new HandoffBoundedCache<string, Promise<ReadonlyArray<PersistedStudioHandoffRecord>>>({
    maxEntries: 128,
  });

  public constructor(private readonly repository: StudioHandoffRepository) {}

  public getByHandoffId(handoffId: string): Promise<PersistedStudioHandoffRecord | undefined> {
    return this.repository.getRecordByHandoffId(handoffId);
  }

  public listBySourceStudio(sourceStudioId: string, limit?: number): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalizedLimit = this.normalizeLimit(limit);
    return this.fromCache(
      `source::${sourceStudioId.trim()}::${normalizedLimit}`,
      () => this.repository.listRecordsBySourceStudio(sourceStudioId, normalizedLimit),
    );
  }

  public listByTargetStudio(targetStudioId: string, limit?: number): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalizedLimit = this.normalizeLimit(limit);
    return this.fromCache(
      `target::${targetStudioId.trim()}::${normalizedLimit}`,
      () => this.repository.listRecordsByTargetStudio(targetStudioId, normalizedLimit),
    );
  }

  public listByAssetVersion(assetId: string, versionId?: string, limit?: number): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalizedLimit = this.normalizeLimit(limit);
    return this.fromCache(
      `asset::${assetId.trim()}::${versionId?.trim() ?? "any"}::${normalizedLimit}`,
      () => this.repository.listRecordsByAssetVersion({ assetId, versionId, limit: normalizedLimit }),
    );
  }

  private fromCache(
    key: string,
    factory: () => Promise<ReadonlyArray<PersistedStudioHandoffRecord>>,
  ): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const cached = this.queryCache.get(key);
    if (cached) {
      return cached;
    }

    const result = factory();
    this.queryCache.set(key, result);
    return result;
  }

  private normalizeLimit(limit: number | undefined): number {
    const raw = typeof limit === "number" && Number.isFinite(limit)
      ? Math.floor(limit)
      : StudioHandoffQueryService.DEFAULT_LIST_LIMIT;
    return Math.min(StudioHandoffQueryService.MAX_LIST_LIMIT, Math.max(0, raw));
  }
}

