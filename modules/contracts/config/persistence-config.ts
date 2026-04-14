export interface PersistenceConfig {
  adapter: string;
  namespace?: string;
  operationTimeoutMs?: number;
}
