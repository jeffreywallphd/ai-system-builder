import path from "node:path";
import type { DesktopStoragePaths } from "../../electron/shared/DesktopContracts";

export interface DesktopAppPathsOptions {
  readonly userDataPath: string;
  readonly logsPath: string;
}

export function resolveDesktopStoragePaths(
  options: DesktopAppPathsOptions,
): DesktopStoragePaths {
  const storageDirectory = path.join(options.userDataPath, "storage");
  return Object.freeze({
    appDataDirectory: options.userDataPath,
    storageDirectory,
    databasePath: path.join(storageDirectory, "ai-loom-studio.sqlite"),
    runtimeDirectory: path.join(options.userDataPath, "runtime"),
    logsDirectory: path.join(options.logsPath, "ai-loom-studio"),
    modelsDirectory: path.join(options.userDataPath, "models"),
    assetsDirectory: path.join(options.userDataPath, "assets"),
  });
}
