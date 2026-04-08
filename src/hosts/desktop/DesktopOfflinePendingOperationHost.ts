import path from "node:path";
import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import {
  OfflinePendingOperationService,
} from "@application/common/OfflinePendingOperationPersistence";
import { DesktopOfflinePendingOperationRepository } from "@infrastructure/desktop/DesktopOfflinePendingOperationRepository";
import { assertDesktopOfflineLocalModeAuthorityBoundary } from "./DesktopOfflineLocalModeProfile";

export interface DesktopOfflinePendingOperationHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly maxEntries?: number;
}

export interface DesktopOfflinePendingOperationHostRuntime {
  readonly service: OfflinePendingOperationService;
  readonly repository: DesktopOfflinePendingOperationRepository;
  readonly databasePath: string;
  dispose(): void;
}

const OFFLINE_PENDING_OPERATION_DATABASE_NAME = "offline-pending-operation-queue.sqlite";

export function createDesktopOfflinePendingOperationHostRuntime(
  options: DesktopOfflinePendingOperationHostOptions,
): DesktopOfflinePendingOperationHostRuntime {
  assertDesktopOfflineLocalModeAuthorityBoundary();

  const databasePath = path.join(
    options.storagePaths.storageDirectory,
    OFFLINE_PENDING_OPERATION_DATABASE_NAME,
  );

  const repository = new DesktopOfflinePendingOperationRepository({
    databasePath,
    maxEntries: options.maxEntries,
  });
  const service = new OfflinePendingOperationService(repository);

  return Object.freeze({
    service,
    repository,
    databasePath,
    dispose: () => {
      repository.dispose();
    },
  });
}
