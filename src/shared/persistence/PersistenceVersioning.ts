export class PersistenceOptimisticConcurrencyError extends Error {
  public readonly entityName: string;
  public readonly expectedRevision: number;
  public readonly currentRevision: number;

  constructor(entityName: string, expectedRevision: number, currentRevision: number) {
    super(
      `${entityName} expectedRevision '${expectedRevision}' did not match persisted revision '${currentRevision}'.`,
    );
    this.name = "PersistenceOptimisticConcurrencyError";
    this.entityName = entityName;
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

export function nextPersistenceRevision(persistedRevision: number | undefined): number {
  const currentRevision = persistedRevision ?? 0;
  return currentRevision + 1;
}

export function assertExpectedPersistenceRevision(
  expectedRevision: number | undefined,
  persistedRevision: number | undefined,
  entityName: string,
): void {
  if (typeof expectedRevision !== "number") {
    return;
  }

  const currentRevision = persistedRevision ?? 0;
  if (expectedRevision !== currentRevision) {
    throw new PersistenceOptimisticConcurrencyError(entityName, expectedRevision, currentRevision);
  }
}
