import type { CanonicalDependencyStateSummary } from "../../assets-system/CanonicalDependencyStateUseCase";

export interface CanonicalDependencyStateRecord {
  readonly versionId: string;
  readonly summary: CanonicalDependencyStateSummary;
  readonly computedAt: Date;
}

export interface ICanonicalDependencyStateRepository {
  saveDependencyState(record: CanonicalDependencyStateRecord): Promise<void>;
  getDependencyState(versionId: string): Promise<CanonicalDependencyStateRecord | undefined>;
}
