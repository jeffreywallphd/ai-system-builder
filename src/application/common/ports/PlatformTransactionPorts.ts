export interface IPlatformTransactionManager {
  runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue>;
}

export async function runInTransactionBoundary<TValue>(
  transactionManager: IPlatformTransactionManager | undefined,
  operation: () => Promise<TValue>,
): Promise<TValue> {
  if (!transactionManager) {
    return operation();
  }

  return transactionManager.runInTransaction(operation);
}

