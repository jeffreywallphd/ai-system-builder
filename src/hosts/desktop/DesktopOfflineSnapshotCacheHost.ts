import path from "node:path";
import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import {
  OfflineAuthoritativeSnapshotCacheService,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import { DesktopOfflineSnapshotCacheRepository } from "@infrastructure/desktop/DesktopOfflineSnapshotCacheRepository";
import {
  assertDesktopOfflineLocalModeAuthorityBoundary,
  type DesktopOfflineLocalModePolicyResolutionOptions,
} from "./DesktopOfflineLocalModeProfile";

export interface DesktopOfflineSnapshotCacheHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly maxEntries?: number;
  readonly supportsProtectedAtRestStorage?: boolean;
  readonly localModePolicy?: DesktopOfflineLocalModePolicyResolutionOptions;
}

export interface DesktopOfflineSnapshotCacheHostRuntime {
  readonly service: OfflineAuthoritativeSnapshotCacheService;
  readonly repository: DesktopOfflineSnapshotCacheRepository;
  readonly databasePath: string;
  dispose(): void;
}

const OFFLINE_SNAPSHOT_CACHE_DATABASE_NAME = "offline-authoritative-snapshot-cache.sqlite";

export function createDesktopOfflineSnapshotCacheHostRuntime(
  options: DesktopOfflineSnapshotCacheHostOptions,
): DesktopOfflineSnapshotCacheHostRuntime {
  assertDesktopOfflineLocalModeAuthorityBoundary(options.localModePolicy);

  const databasePath = path.join(
    options.storagePaths.storageDirectory,
    OFFLINE_SNAPSHOT_CACHE_DATABASE_NAME,
  );
  const repository = new DesktopOfflineSnapshotCacheRepository({
    databasePath,
    maxEntries: options.maxEntries,
    supportsProtectedAtRestStorage: options.supportsProtectedAtRestStorage,
  });
  const service = new OfflineAuthoritativeSnapshotCacheService(repository);

  return Object.freeze({
    service,
    repository,
    databasePath,
    dispose: () => {
      repository.dispose();
    },
  });
}
