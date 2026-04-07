export interface ProductionStorageInitializationRequest {
  readonly createIfMissing?: boolean;
}

export interface ProductionStorageInitializationResult {
  readonly appDataDirectory: string;
  readonly storageDirectory: string;
  readonly databasePath: string;
  readonly createdDirectories: ReadonlyArray<string>;
  readonly appliedMigrations: ReadonlyArray<string>;
}

export interface IProductionStorageInitializer {
  initialize(
    request?: ProductionStorageInitializationRequest,
  ): Promise<ProductionStorageInitializationResult>;
}
