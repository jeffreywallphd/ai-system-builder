import type { ContextPackage } from "../../context/models/ContextPackage";

export interface IContextPackageListCriteria {
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface IContextPackageSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags: ReadonlyArray<string>;
  readonly fragmentCount: number;
  readonly updatedAt?: Date;
}

export interface IContextPackageRepository {
  save(contextPackage: ContextPackage): Promise<ContextPackage>;
  load(id: string): Promise<ContextPackage | undefined>;
  list(criteria?: IContextPackageListCriteria): Promise<ReadonlyArray<IContextPackageSummary>>;
  exists(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}
