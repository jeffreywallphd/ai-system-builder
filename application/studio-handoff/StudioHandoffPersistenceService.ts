import type { StudioHandoffContract, StudioHandoffAssetRole } from "../../domain/studio-handoff/StudioHandoffContract";
import type { StudioHandoffContext, StudioHandoffSourceReference } from "../../domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffDependencyRecord } from "./CrossStudioDependencyGraph";
import type { StudioHandoffLineageRecord } from "./StudioHandoffLineageTracker";
import type {
  StudioHandoffChangeSet,
  StudioHandoffFailure,
  StudioHandoffPreparation,
  StudioHandoffRevision,
} from "./StudioHandoffOrchestrationService";

export interface StudioHandoffRevisionRecord {
  readonly revisionId: string;
  readonly previousHandoffId: string;
  readonly updatedHandoffId: string;
  readonly createdAt: string;
  readonly changes?: StudioHandoffChangeSet;
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
  readonly lineageRecordId?: string;
  readonly dependencyRecordId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudioHandoffRepository {
  saveRecord(record: PersistedStudioHandoffRecord): Promise<PersistedStudioHandoffRecord>;
  getRecordByHandoffId(handoffId: string): Promise<PersistedStudioHandoffRecord | undefined>;
  listRecordsBySourceStudio(sourceStudioId: string): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
  listRecordsByTargetStudio(targetStudioId: string): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
  listRecordsByAssetVersion(params: { assetId: string; versionId?: string }): Promise<ReadonlyArray<PersistedStudioHandoffRecord>>;
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
    lineageRecordId: input.lineage?.recordId,
    dependencyRecordId: input.dependency?.recordId,
    createdAt: now,
    updatedAt: now,
  });
}

export class StudioHandoffPersistenceService {
  public constructor(private readonly repository: StudioHandoffRepository) {}

  public async persistPrepared(input: {
    readonly preparation: StudioHandoffPreparation;
    readonly revision?: StudioHandoffRevision;
    readonly changes?: StudioHandoffChangeSet;
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
      lineage: input.lineage ?? input.preparation.lineage,
      dependency: input.dependency,
    });

    return this.repository.saveRecord(record);
  }

  public async persistFailure(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly failure: StudioHandoffFailure;
    readonly revision?: StudioHandoffRevision;
    readonly changes?: StudioHandoffChangeSet;
  }): Promise<PersistedStudioHandoffRecord> {
    const record = toRecord({
      handoff: input.handoff,
      context: input.context,
      status: "failed",
      issueCodes: [input.failure.code, ...input.failure.issues.map((entry) => entry.code)],
      revision: input.revision,
      changes: input.changes,
    });
    return this.repository.saveRecord(record);
  }
}

export class StudioHandoffQueryService {
  public constructor(private readonly repository: StudioHandoffRepository) {}

  public getByHandoffId(handoffId: string): Promise<PersistedStudioHandoffRecord | undefined> {
    return this.repository.getRecordByHandoffId(handoffId);
  }

  public listBySourceStudio(sourceStudioId: string): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    return this.repository.listRecordsBySourceStudio(sourceStudioId);
  }

  public listByTargetStudio(targetStudioId: string): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    return this.repository.listRecordsByTargetStudio(targetStudioId);
  }

  public listByAssetVersion(assetId: string, versionId?: string): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    return this.repository.listRecordsByAssetVersion({ assetId, versionId });
  }
}
