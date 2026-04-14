export interface PersistenceRecordReference {
  recordType: string;
  id: string;
}

export function createPersistenceRecordReference(
  recordType: string,
  id: string,
): PersistenceRecordReference {
  return {
    recordType,
    id,
  };
}

