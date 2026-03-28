import type { StudioHandoffPreparation, StudioHandoffRevision } from "./StudioHandoffOrchestrationService";

export interface StudioHandoffDerivationReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly relation?: string;
  readonly role?: string;
}

export interface StudioHandoffLineageEdge {
  readonly edgeId: string;
  readonly handoffId: string;
  readonly handoffRevisionId?: string;
  readonly fromVersionId: string;
  readonly toTargetStudioId: string;
  readonly toTargetStudioType: string;
  readonly adaptedTargetReference?: StudioHandoffDerivationReference;
  readonly createdAt: string;
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface StudioHandoffLineageRecord {
  readonly recordId: string;
  readonly handoffId: string;
  readonly handoffRevisionId?: string;
  readonly previousHandoffId?: string;
  readonly targetStudioId: string;
  readonly targetStudioType: string;
  readonly sourceVersions: ReadonlyArray<StudioHandoffDerivationReference>;
  readonly resultingTargetReferences: ReadonlyArray<StudioHandoffDerivationReference>;
  readonly edges: ReadonlyArray<StudioHandoffLineageEdge>;
  readonly capturedAt: string;
  readonly context: {
    readonly correlationId?: string;
    readonly initiatedAt?: string;
    readonly intentKind: string;
  };
}

export interface StudioHandoffLineageEvent {
  readonly kind: "studio-handoff-lineage-recorded";
  readonly record: StudioHandoffLineageRecord;
}

export class StudioHandoffLineageTracker {
  private readonly records: StudioHandoffLineageRecord[] = [];

  public track(input: {
    readonly preparation: StudioHandoffPreparation;
    readonly revision?: StudioHandoffRevision;
  }): StudioHandoffLineageEvent {
    const capturedAt = new Date().toISOString();
    const handoff = input.preparation.handoff;
    const sourceVersions = handoff.multiAsset
      ? handoff.multiAsset.assets.map((entry) => Object.freeze({
        assetId: entry.pinnedVersion?.assetId ?? entry.assetId,
        versionId: entry.pinnedVersion?.versionId ?? entry.versionId,
        relation: entry.role,
        role: entry.role,
      }))
      : [Object.freeze({
        assetId: handoff.payload.pinnedVersion?.assetId ?? handoff.payload.assetId,
        versionId: handoff.payload.pinnedVersion?.versionId ?? handoff.payload.versionId,
        relation: "primary",
        role: "primary",
      })];

    const resultingTargetReferences = input.preparation.targetInput.sourceReferences
      .map((reference) => Object.freeze({
        assetId: reference.assetId,
        versionId: reference.versionId,
        relation: reference.relation,
      }));

    const edges = sourceVersions.map((source, index) => Object.freeze({
      edgeId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:${index}`,
      handoffId: handoff.id.value,
      handoffRevisionId: input.revision?.revisionId,
      fromVersionId: source.versionId,
      toTargetStudioId: handoff.target.studioId,
      toTargetStudioType: handoff.target.studioType,
      adaptedTargetReference: resultingTargetReferences[index] ?? resultingTargetReferences[0],
      createdAt: capturedAt,
      provenance: Object.freeze({
        sourceStudioId: handoff.source.studioId,
        sourceStudioType: handoff.source.studioType,
      }),
    }));

    const record = Object.freeze({
      recordId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:lineage`,
      handoffId: handoff.id.value,
      handoffRevisionId: input.revision?.revisionId,
      previousHandoffId: input.revision?.previousHandoffId,
      targetStudioId: handoff.target.studioId,
      targetStudioType: handoff.target.studioType,
      sourceVersions: Object.freeze(sourceVersions),
      resultingTargetReferences: Object.freeze(resultingTargetReferences),
      edges: Object.freeze(edges),
      capturedAt,
      context: Object.freeze({
        correlationId: input.preparation.context.provenance?.correlationId,
        initiatedAt: input.preparation.context.initiatedAt,
        intentKind: handoff.intent.kind,
      }),
    });

    this.records.push(record);
    return Object.freeze({
      kind: "studio-handoff-lineage-recorded",
      record,
    });
  }

  public listRecords(): ReadonlyArray<StudioHandoffLineageRecord> {
    return Object.freeze([...this.records]);
  }
}
