import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import { OfflineControlledResynchronizationCoordinator } from "@application/common/OfflineControlledResynchronizationCoordinator";
import type { IOfflineOperationalEventSink } from "@application/common/OfflineOperationalEventPorts";
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
  createDesktopOfflineLocalExecutionRegistrationHostRuntime,
  type DesktopOfflineLocalExecutionRegistrationHostRuntime,
} from "./DesktopOfflineLocalExecutionRegistrationHost";
import {
  createDesktopOfflineSnapshotCacheHostRuntime,
  type DesktopOfflineSnapshotCacheHostRuntime,
} from "./DesktopOfflineSnapshotCacheHost";

export interface DesktopOfflineResynchronizationHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly authoritativePort: IOfflineAuthoritativeResynchronizationPort;
  readonly connectivityStatePort?: IOfflineConnectivityStatePort;
  readonly pendingOperationMaxEntries?: number;
  readonly localExecutionRegistrationMaxEntries?: number;
  readonly snapshotCacheMaxEntries?: number;
  readonly supportsProtectedAtRestStorage?: boolean;
  readonly eventSink?: IOfflineOperationalEventSink;
  readonly eventContext?: {
    readonly workspaceId?: string;
    readonly actorUserIdentityId?: string;
  };
  readonly now?: () => Date;
}

export interface DesktopOfflineResynchronizationHostRuntime {
  readonly coordinator: OfflineControlledResynchronizationCoordinator;
  readonly pendingOperationRuntime: DesktopOfflinePendingOperationHostRuntime;
  readonly localExecutionRegistrationRuntime: DesktopOfflineLocalExecutionRegistrationHostRuntime;
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
  const localExecutionRegistrationRuntime = createDesktopOfflineLocalExecutionRegistrationHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.localExecutionRegistrationMaxEntries,
  });
  const snapshotCacheRuntime = createDesktopOfflineSnapshotCacheHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.snapshotCacheMaxEntries,
    supportsProtectedAtRestStorage: options.supportsProtectedAtRestStorage,
  });
  const connectivityStatePort = options.connectivityStatePort
    ?? new DesktopConnectivityStatePortAdapter(new DesktopConnectivityStateService({
      now: options.now,
      eventSink: options.eventSink,
      eventContext: options.eventContext,
    }));

  const coordinator = new OfflineControlledResynchronizationCoordinator(
    pendingOperationRuntime.service,
    localExecutionRegistrationRuntime.service,
    snapshotCacheRuntime.service,
    options.authoritativePort,
    connectivityStatePort,
    {
      now: options.now,
      eventSink: options.eventSink,
    },
  );

  return Object.freeze({
    coordinator,
    pendingOperationRuntime,
    localExecutionRegistrationRuntime,
    snapshotCacheRuntime,
    connectivityStatePort,
    dispose: () => {
      pendingOperationRuntime.dispose();
      localExecutionRegistrationRuntime.dispose();
      snapshotCacheRuntime.dispose();
    },
  });
}
