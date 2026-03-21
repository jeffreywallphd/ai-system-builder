import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { DesktopPythonRuntimeInfo, DesktopStoragePaths } from "../../electron/shared/DesktopContracts";

export interface DesktopPythonRuntimeResolverOptions {
  readonly isPackaged: boolean;
  readonly repoRoot: string;
  readonly resourcesPath: string;
  readonly storagePaths: DesktopStoragePaths;
}

const PLATFORM_FOLDER = `${process.platform}-${process.arch}`;

export function resolveDesktopPythonRuntime(
  options: DesktopPythonRuntimeResolverOptions,
): DesktopPythonRuntimeInfo {
  if (!options.isPackaged) {
    return Object.freeze({
      mode: "development-local",
      executablePath: process.env.PYTHON_RUNTIME_INTERPRETER_PATH?.trim() || process.env.PYTHON_RUNTIME_EXECUTABLE?.trim(),
      runtimeRoot: path.join(options.repoRoot, "python-runtime"),
      workspaceDirectory: path.join(options.repoRoot, "python-runtime"),
      manifestPath: undefined,
      isAvailable: true,
    });
  }

  const runtimeRoot = path.join(options.resourcesPath, "runtime-assets", "python", PLATFORM_FOLDER);
  const manifestPath = path.join(runtimeRoot, "manifest.json");
  const executablePath = process.platform === "win32"
    ? path.join(runtimeRoot, "python", "python.exe")
    : path.join(runtimeRoot, "python", "bin", "python3");

  return Object.freeze({
    mode: "packaged-private",
    executablePath,
    runtimeRoot,
    workspaceDirectory: options.storagePaths.runtimeDirectory,
    manifestPath,
    isAvailable: fs.existsSync(executablePath),
  });
}
