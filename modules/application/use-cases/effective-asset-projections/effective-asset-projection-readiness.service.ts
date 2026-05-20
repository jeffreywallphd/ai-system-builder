import type { EffectiveAssetProjectionStatus } from "../../../contracts/effective-asset-projections";

export class EffectiveAssetProjectionReadinessService {
  isExecutionReady(status: EffectiveAssetProjectionStatus): boolean {
    return status === "ready";
  }
}

export const defaultEffectiveAssetProjectionReadinessService = new EffectiveAssetProjectionReadinessService();
