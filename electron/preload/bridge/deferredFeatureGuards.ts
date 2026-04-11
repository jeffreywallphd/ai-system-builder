import {
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
  type DesktopPostLoginRuntimeStatus,
} from "../../shared/DesktopContracts";
import type { AsyncBridgeGroup, AsyncBridgeMethod, DeferredBridgeGuards, SyncBridgeGroup, SyncBridgeMethod } from "./types";

export const DeferredFeatureApiUnavailableCode = "AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE";
export const DeferredFeatureApiUnavailableDetail = "Desktop feature APIs are unavailable until post-login runtime initialization completes.";

export interface DeferredFeatureGuardDependencies {
  isDeferredFeatureApiReady(): boolean;
  getPostLoginRuntimeStatus(): DesktopPostLoginRuntimeStatus;
  startDeferredFeatureWarmupOnDemand(): void;
}

export function createDeferredFeatureUnavailableError(
  apiPath: string,
  getRuntimeStatus: () => DesktopPostLoginRuntimeStatus,
): Error & { code: string } {
  const runtimeStatus = getRuntimeStatus();
  const state = runtimeStatus.state;
  const unavailableReason = runtimeStatus.unavailableReason ? ` (${runtimeStatus.unavailableReason})` : "";
  const error = new Error(
    `${DeferredFeatureApiUnavailableDetail} Current runtime state: ${state}${unavailableReason}. Requested API: ${apiPath}.`,
  ) as Error & { code: string };
  error.code = DeferredFeatureApiUnavailableCode;
  return error;
}

export function createFallbackPostLoginRuntimeStatus(): DesktopPostLoginRuntimeStatus {
  return Object.freeze({
    state: DesktopPostLoginRuntimeStates.unavailable,
    unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
    updatedAt: new Date().toISOString(),
  });
}

export function createDeferredBridgeGuards(deps: DeferredFeatureGuardDependencies): DeferredBridgeGuards {
  function guardDeferredSyncGroup<TGroup extends SyncBridgeGroup>(groupName: string, group: TGroup): TGroup {
    const entries = Object.entries(group).map(([methodName, method]) => {
      const guarded: SyncBridgeMethod = (...args: ReadonlyArray<any>) => {
        if (!deps.isDeferredFeatureApiReady()) {
          deps.startDeferredFeatureWarmupOnDemand();
          throw createDeferredFeatureUnavailableError(`${groupName}.${methodName}`, deps.getPostLoginRuntimeStatus);
        }
        return method(...args);
      };
      return [methodName, guarded];
    });
    return Object.freeze(Object.fromEntries(entries)) as TGroup;
  }

  function guardDeferredAsyncGroup<TGroup extends AsyncBridgeGroup>(groupName: string, group: TGroup): TGroup {
    const entries = Object.entries(group).map(([methodName, method]) => {
      const guarded: AsyncBridgeMethod = (...args: ReadonlyArray<any>) => {
        if (!deps.isDeferredFeatureApiReady()) {
          deps.startDeferredFeatureWarmupOnDemand();
          return Promise.reject(createDeferredFeatureUnavailableError(`${groupName}.${methodName}`, deps.getPostLoginRuntimeStatus));
        }
        return method(...args);
      };
      return [methodName, guarded];
    });
    return Object.freeze(Object.fromEntries(entries)) as TGroup;
  }

  return Object.freeze({
    guardDeferredSyncGroup,
    guardDeferredAsyncGroup,
  });
}
