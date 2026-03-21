import type {
  IProductionStorageInitializer,
  ProductionStorageInitializationRequest,
  ProductionStorageInitializationResult,
} from "./interfaces/IProductionStorageInitializer";

export class InitializeProductionStorageUseCase {
  constructor(
    private readonly initializer: IProductionStorageInitializer,
  ) {}

  public async execute(
    request: ProductionStorageInitializationRequest = {},
  ): Promise<ProductionStorageInitializationResult> {
    return this.initializer.initialize(request);
  }
}
