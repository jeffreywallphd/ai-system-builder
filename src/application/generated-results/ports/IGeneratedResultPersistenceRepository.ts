import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";

export interface GeneratedResultRecordListQuery {
  readonly workspaceId: string;
  readonly runId?: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly statuses?: ReadonlyArray<GeneratedResultPersistenceRecord["status"]>;
  readonly visibilities?: ReadonlyArray<GeneratedResultPersistenceRecord["visibility"]>;
  readonly mediaTypes?: ReadonlyArray<NonNullable<GeneratedResultPersistenceRecord["mediaType"]>>;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly includeArchived?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GeneratedResultLineageRecord {
  readonly resultAssetId: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly inputAssetIds: ReadonlyArray<string>;
  readonly workflowTemplateVersionId?: string;
  readonly workflowTemplateVersionTag?: string;
  readonly systemSnapshotId?: string;
  readonly systemVersionTag?: string;
  readonly parameterSnapshotId?: string;
  readonly selectedNodeId?: string;
  readonly executionAdapterKind?: string;
  readonly executionBackendFamily?: string;
  readonly updatedAt: string;
}

export interface IGeneratedResultPersistenceRepository {
  findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined>;
  listResults(query: GeneratedResultRecordListQuery): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>>;
  listResultsByRun(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>>;
  createResult(
    record: GeneratedResultPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>>;
  saveResult(
    record: GeneratedResultPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>>;
  savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>>;
  listPreviewsByResultId(resultAssetId: string): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>>;
  getLineageByResultId(resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined>;
}
