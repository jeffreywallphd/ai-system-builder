export const ProductionStorageInitializationScopes = Object.freeze({
  authShellPreLogin: "auth-shell-pre-login",
  fullRuntime: "full-runtime",
});

export type ProductionStorageInitializationScope =
  (typeof ProductionStorageInitializationScopes)[keyof typeof ProductionStorageInitializationScopes];

export interface ProductionStorageInitializationRequest {
  readonly createIfMissing?: boolean;
  readonly scope?: ProductionStorageInitializationScope;
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
