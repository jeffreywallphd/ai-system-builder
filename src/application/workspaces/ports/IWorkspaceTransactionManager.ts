export interface IWorkspaceTransactionManager {
  runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue>;
}
