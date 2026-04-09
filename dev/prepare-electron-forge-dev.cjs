const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");

const RETRYABLE_CODES = new Set(["EBUSY", "ENOTEMPTY", "EPERM", "EMFILE", "ENFILE"]);
const DEFAULT_MAX_ATTEMPTS = 30;
const TARGET_VITE_DIR = path.resolve(".vite");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeDirectoryWithRetries(targetPath, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rm(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 120,
      });
      return;
    } catch (error) {
      if (!error || !RETRYABLE_CODES.has(error.code) || attempt === maxAttempts) {
        throw error;
      }

      const backoffMs = Math.min(2000, 100 + attempt * 120);
      await sleep(backoffMs);
    }
  }
}

async function cleanupStaleViteDirectories() {
  const projectRoot = path.dirname(TARGET_VITE_DIR);
  const entries = await fs.readdir(projectRoot, { withFileTypes: true });
  const staleDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(".vite.stale-"))
    .map((entry) => path.join(projectRoot, entry.name));

  for (const staleDirectory of staleDirectories) {
    try {
      await removeDirectoryWithRetries(staleDirectory, 5);
    } catch (error) {
      console.warn(`[dev-preflight] Unable to remove stale Vite directory: ${staleDirectory}`);
      console.warn(`[dev-preflight] ${error.code || "UNKNOWN"}: ${error.message}`);
    }
  }
}

async function prepareDesktopDevStart() {
  await cleanupStaleViteDirectories();
  await ensureElectronNativeModuleCompatibility();

  try {
    await removeDirectoryWithRetries(TARGET_VITE_DIR);
  } catch (error) {
    const stalePath = `${TARGET_VITE_DIR}.stale-${Date.now()}`;
    try {
      await fs.rename(TARGET_VITE_DIR, stalePath);
      await removeDirectoryWithRetries(stalePath, 8);
      return;
    } catch {
      const code = error && error.code ? error.code : "UNKNOWN";
      const message = error && error.message ? error.message : "Unknown error";
      throw new Error(
        `[dev-preflight] Unable to clear ${TARGET_VITE_DIR} before Electron Forge start (${code}: ${message}). ` +
          "Close lingering Electron/Node processes and retry."
      );
    }
  }
}

function canLoadBetterSqlite3() {
  try {
    const moduleRequire = createRequire(path.join(process.cwd(), "package.json"));
    const BetterSqlite3 = moduleRequire("better-sqlite3");
    return typeof BetterSqlite3 === "function";
  } catch {
    return false;
  }
}

function resolveInstalledElectronVersion() {
  const moduleRequire = createRequire(path.join(process.cwd(), "package.json"));
  const electronPackageJson = moduleRequire("electron/package.json");
  if (!electronPackageJson || typeof electronPackageJson.version !== "string") {
    throw new Error("[dev-preflight] Unable to resolve installed Electron version for native dependency rebuild.");
  }

  return electronPackageJson.version;
}

function rebuildBetterSqlite3ForElectron() {
  const electronVersion = resolveInstalledElectronVersion();
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["rebuild", "better-sqlite3", `--target=${electronVersion}`, "--runtime=electron"],
    {
      stdio: "inherit",
      shell: false,
      env: process.env,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `[dev-preflight] Failed to rebuild better-sqlite3 for Electron ${electronVersion}. ` +
        "Install required native build tools and rerun npm install.",
    );
  }
}

async function ensureElectronNativeModuleCompatibility() {
  if (canLoadBetterSqlite3()) {
    return;
  }

  console.warn("[dev-preflight] better-sqlite3 is not loadable. Rebuilding for the local Electron runtime...");
  rebuildBetterSqlite3ForElectron();

  if (!canLoadBetterSqlite3()) {
    throw new Error(
      "[dev-preflight] better-sqlite3 remains unavailable after rebuild. " +
        "Delete node_modules, reinstall dependencies, and ensure native build prerequisites are installed.",
    );
  }
}

prepareDesktopDevStart().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
