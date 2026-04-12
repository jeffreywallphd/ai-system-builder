import path from "node:path";
import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import { OfflineLocalExecutionRegistrationService } from "@application/common/OfflineLocalExecutionRegistrationPersistence";
import { DesktopOfflineLocalExecutionRegistrationRepository } from "@infrastructure/desktop/DesktopOfflineLocalExecutionRegistrationRepository";
import {
  assertDesktopOfflineLocalModeAuthorityBoundary,
  type DesktopOfflineLocalModePolicyResolutionOptions,
} from "./DesktopOfflineLocalModeProfile";

export interface DesktopOfflineLocalExecutionRegistrationHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly maxEntries?: number;
  readonly localModePolicy?: DesktopOfflineLocalModePolicyResolutionOptions;
}

export interface DesktopOfflineLocalExecutionRegistrationHostRuntime {
  readonly service: OfflineLocalExecutionRegistrationService;
  readonly repository: DesktopOfflineLocalExecutionRegistrationRepository;
  readonly databasePath: string;
  dispose(): void;
}

const OFFLINE_LOCAL_EXECUTION_REGISTRATION_DATABASE_NAME = "offline-local-execution-registration-queue.sqlite";

export function createDesktopOfflineLocalExecutionRegistrationHostRuntime(
  options: DesktopOfflineLocalExecutionRegistrationHostOptions,
): DesktopOfflineLocalExecutionRegistrationHostRuntime {
  assertDesktopOfflineLocalModeAuthorityBoundary(options.localModePolicy);

  const databasePath = path.join(
    options.storagePaths.storageDirectory,
    OFFLINE_LOCAL_EXECUTION_REGISTRATION_DATABASE_NAME,
  );

  const repository = new DesktopOfflineLocalExecutionRegistrationRepository({
    databasePath,
    maxEntries: options.maxEntries,
  });
  const service = new OfflineLocalExecutionRegistrationService(repository);

  return Object.freeze({
    service,
    repository,
    databasePath,
    dispose: () => {
      repository.dispose();
    },
  });
}
