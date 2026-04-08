import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import { OfflineControlledResynchronizationCoordinator } from "@application/common/OfflineControlledResynchronizationCoordinator";
import type {
  IOfflineAuthoritativeResynchronizationPort,
  IOfflineConnectivityStatePort,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import { DesktopConnectivityStateService } from "./DesktopConnectivityStateService";
import {
  createDesktopOfflinePendingOperationHostRuntime,
  type DesktopOfflinePendingOperationHostRuntime,
} from "./DesktopOfflinePendingOperationHost";
import {
  createDesktopOfflineSnapshotCacheHostRuntime,
  type DesktopOfflineSnapshotCacheHostRuntime,
} from "./DesktopOfflineSnapshotCacheHost";

export interface DesktopOfflineResynchronizationHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly authoritativePort: IOfflineAuthoritativeResynchronizationPort;
  readonly connectivityStatePort?: IOfflineConnectivityStatePort;
  readonly pendingOperationMaxEntries?: number;
  readonly snapshotCacheMaxEntries?: number;
  readonly supportsProtectedAtRestStorage?: boolean;
  readonly now?: () => Date;
}

export interface DesktopOfflineResynchronizationHostRuntime {
  readonly coordinator: OfflineControlledResynchronizationCoordinator;
  readonly pendingOperationRuntime: DesktopOfflinePendingOperationHostRuntime;
  readonly snapshotCacheRuntime: DesktopOfflineSnapshotCacheHostRuntime;
  readonly connectivityStatePort: IOfflineConnectivityStatePort;
  dispose(): void;
}

class DesktopConnectivityStatePortAdapter implements IOfflineConnectivityStatePort {
  constructor(private readonly connectivityStateService: DesktopConnectivityStateService) {}

  public async getConnectivityState() {
    return this.connectivityStateService.getState();
  }
}

export function createDesktopOfflineResynchronizationHostRuntime(
  options: DesktopOfflineResynchronizationHostOptions,
): DesktopOfflineResynchronizationHostRuntime {
  const pendingOperationRuntime = createDesktopOfflinePendingOperationHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.pendingOperationMaxEntries,
  });
  const snapshotCacheRuntime = createDesktopOfflineSnapshotCacheHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.snapshotCacheMaxEntries,
    supportsProtectedAtRestStorage: options.supportsProtectedAtRestStorage,
  });
  const connectivityStatePort = options.connectivityStatePort
    ?? new DesktopConnectivityStatePortAdapter(new DesktopConnectivityStateService({
      now: options.now,
    }));

  const coordinator = new OfflineControlledResynchronizationCoordinator(
    pendingOperationRuntime.service,
    snapshotCacheRuntime.service,
    options.authoritativePort,
    connectivityStatePort,
    {
      now: options.now,
    },
  );

  return Object.freeze({
    coordinator,
    pendingOperationRuntime,
    snapshotCacheRuntime,
    connectivityStatePort,
    dispose: () => {
      pendingOperationRuntime.dispose();
      snapshotCacheRuntime.dispose();
    },
  });
}
