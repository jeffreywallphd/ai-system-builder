export interface PersistenceReadMapper<TPersistenceRecord, TDomainRecord> {
  toDomain(persistenceRecord: TPersistenceRecord): TDomainRecord;
}

export interface PersistenceWriteMapper<TDomainRecord, TPersistenceWriteShape> {
  toPersistence(domainRecord: TDomainRecord): TPersistenceWriteShape;
}

export interface PersistenceBidirectionalMapper<
  TPersistenceRecord,
  TDomainRecord,
  TPersistenceWriteShape = TPersistenceRecord,
> extends PersistenceReadMapper<TPersistenceRecord, TDomainRecord>,
    PersistenceWriteMapper<TDomainRecord, TPersistenceWriteShape> {}

export interface PersistenceRowMapper<TRowRecord, TDomainRecord>
  extends PersistenceBidirectionalMapper<TRowRecord, TDomainRecord, ReadonlyArray<unknown>> {}

export interface PersistenceReplayParser<TReplayRecord> {
  parseReplaySnapshot(snapshotJson: string): TReplayRecord;
}

export interface PersistenceMapperBoundary<
  TRowRecord,
  TDomainRecord,
  TReplayRecord = TDomainRecord,
> extends PersistenceRowMapper<TRowRecord, TDomainRecord>,
    PersistenceReplayParser<TReplayRecord> {}

export function createPersistenceMapperBoundary<
  TRowRecord,
  TDomainRecord,
  TReplayRecord = TDomainRecord,
>(
  mapper: PersistenceMapperBoundary<TRowRecord, TDomainRecord, TReplayRecord>,
): PersistenceMapperBoundary<TRowRecord, TDomainRecord, TReplayRecord> {
  return Object.freeze(mapper);
}

export function parsePersistenceReplaySnapshot<TReplayRecord>(
  snapshotJson: string,
  parser: (payload: unknown) => TReplayRecord,
): TReplayRecord {
  try {
    const payload = JSON.parse(snapshotJson) as unknown;
    return parser(payload);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Persistence replay snapshot is invalid: ${details}`);
  }
}
