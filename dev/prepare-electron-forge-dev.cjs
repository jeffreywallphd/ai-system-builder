const fs = require("node:fs/promises");
const path = require("node:path");

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

prepareDesktopDevStart().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
