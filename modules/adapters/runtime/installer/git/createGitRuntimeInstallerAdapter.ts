import { execFile as nodeExecFile } from "node:child_process";
import { mkdir as nodeMkdir, readFile as nodeReadFile, readdir as nodeReaddir, stat as nodeStat, writeFile as nodeWriteFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  RuntimeInstallRequest,
  RuntimeInstallResult,
  RuntimeInstallSource,
  RuntimeInstallStatusRequest,
  RuntimeInstallStatusResult,
} from "../../../../contracts/runtime-installer";
import type { RuntimeInstallerPort } from "../../../../application/ports/runtime-installer/runtime-installer.port";

type ExecFileLike = (file: string, args?: readonly string[]) => Promise<{ stdout: string; stderr: string }>;

interface RuntimeInstallMetadata {
  managedBy: "ai-system-builder";
  targetId: string;
  installRoot: string;
  source: RuntimeInstallSource;
  requestedRef?: string;
  resolvedRef?: string;
  commitSha?: string;
  installedAt: string;
  lastCheckedAt: string;
}

export interface CreateGitRuntimeInstallerAdapterOptions {
  gitCommand?: string;
  execFile?: ExecFileLike;
  readFile?: typeof nodeReadFile;
  writeFile?: typeof nodeWriteFile;
  mkdir?: typeof nodeMkdir;
  stat?: typeof nodeStat;
  readdir?: typeof nodeReaddir;
  now?: () => string;
  metadataFileName?: string;
}

const defaultExecFile = promisify(nodeExecFile);

export function createGitRuntimeInstallerAdapter(
  options: CreateGitRuntimeInstallerAdapterOptions = {},
): RuntimeInstallerPort {
  const gitCommand = options.gitCommand ?? "git";
  const execFile = options.execFile ?? ((file: string, args: readonly string[] = []) => defaultExecFile(file, [...args]));
  const readFile = options.readFile ?? nodeReadFile;
  const writeFile = options.writeFile ?? nodeWriteFile;
  const mkdir = options.mkdir ?? nodeMkdir;
  const stat = options.stat ?? nodeStat;
  const readdir = options.readdir ?? nodeReaddir;
  const now = options.now ?? (() => new Date().toISOString());
  const metadataFileName = options.metadataFileName ?? ".ai-system-builder-runtime-install.json";

  const getMetadataPath = (installRoot: string) => path.join(installRoot, metadataFileName);

  const makeError = (code: string, message: string, details?: Record<string, unknown>) => ({ code, message, details });

  async function pathExists(targetPath: string): Promise<boolean> {
    try {
      await stat(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async function isDirectoryEmpty(targetPath: string): Promise<boolean> {
    const entries = await readdir(targetPath);
    return entries.length === 0;
  }

  async function readMetadata(installRoot: string): Promise<RuntimeInstallMetadata | undefined> {
    const metadataPath = getMetadataPath(installRoot);
    if (!(await pathExists(metadataPath))) {
      return undefined;
    }
    try {
      const content = await readFile(metadataPath, "utf-8");
      return JSON.parse(content) as RuntimeInstallMetadata;
    } catch {
      throw makeError("metadata-read-failed", `Failed to read metadata from ${metadataPath}`);
    }
  }

  async function writeMetadata(metadata: RuntimeInstallMetadata): Promise<void> {
    const metadataPath = getMetadataPath(metadata.installRoot);
    try {
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    } catch {
      throw makeError("metadata-write-failed", `Failed to write metadata to ${metadataPath}`);
    }
  }

  const isManaged = (metadata: RuntimeInstallMetadata | undefined, targetId: string) =>
    metadata?.managedBy === "ai-system-builder" && metadata.targetId === targetId;

  async function getInstallStatus(request: RuntimeInstallStatusRequest): Promise<RuntimeInstallStatusResult> {
    if (!request.installRoot) {
      return {
        targetId: request.targetId,
        status: "unknown",
        source: request.source,
        error: makeError("missing-install-root", "installRoot is required"),
      };
    }

    const installRootExists = await pathExists(request.installRoot);
    if (!installRootExists) {
      return { targetId: request.targetId, status: "not-installed", installRoot: request.installRoot, source: request.source };
    }

    if (await isDirectoryEmpty(request.installRoot)) {
      return { targetId: request.targetId, status: "not-installed", installRoot: request.installRoot, source: request.source };
    }

    let metadata: RuntimeInstallMetadata | undefined;
    try {
      metadata = await readMetadata(request.installRoot);
    } catch (error) {
      return {
        targetId: request.targetId,
        status: "failed",
        installRoot: request.installRoot,
        source: request.source,
        error: error as RuntimeInstallResult["error"],
      };
    }

    if (isManaged(metadata, request.targetId)) {
      return {
        targetId: request.targetId,
        status: "installed",
        installRoot: request.installRoot,
        source: metadata?.source,
        requestedRef: metadata?.requestedRef,
        resolvedRef: metadata?.resolvedRef,
        commitSha: metadata?.commitSha,
        installedAt: metadata?.installedAt,
        lastCheckedAt: metadata?.lastCheckedAt,
      };
    }

    return {
      targetId: request.targetId,
      status: "failed",
      installRoot: request.installRoot,
      source: request.source,
      error: makeError("unmanaged-install-root", "Install root is non-empty and unmanaged"),
    };
  }

  async function runGit(args: string[], code: string) {
    try {
      return await execFile(gitCommand, args);
    } catch (error) {
      throw makeError(code, `Git command failed: ${args.join(" ")}`, { cause: error });
    }
  }

  async function ensureInstalled(request: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    if (!request.installRoot) {
      return { targetId: request.targetId, status: "failed", installRoot: "", source: request.source, error: makeError("missing-install-root", "installRoot is required") };
    }
    if (request.source.type !== "git") {
      return { targetId: request.targetId, status: "failed", installRoot: request.installRoot, source: request.source, error: makeError("unsupported-install-source", "Only git sources are supported") };
    }
    if (!request.source.repositoryUrl) {
      return { targetId: request.targetId, status: "failed", installRoot: request.installRoot, source: request.source, error: makeError("missing-repository-url", "repositoryUrl is required") };
    }

    const status = await getInstallStatus(request);
    if (status.status === "installed" && !request.allowUpdate) {
      return {
        targetId: request.targetId,
        status: "installed",
        installRoot: request.installRoot,
        source: status.source ?? request.source,
        requestedRef: status.requestedRef,
        resolvedRef: status.resolvedRef,
        commitSha: status.commitSha,
        installedAt: status.installedAt,
        lastCheckedAt: status.lastCheckedAt,
      };
    }

    if (status.status === "failed" || status.status === "unknown") {
      return {
        targetId: request.targetId,
        status: "failed",
        installRoot: request.installRoot,
        source: request.source,
        error: status.error ?? makeError("unmanaged-install-root", "Cannot modify unmanaged install root"),
      };
    }

    const installedAt = now();
    const requestedRef = request.source.ref;

    try {
      if (status.status === "not-installed") {
        await mkdir(path.dirname(request.installRoot), { recursive: true });
        await mkdir(request.installRoot, { recursive: true });
        await runGit(["clone", request.source.repositoryUrl, request.installRoot], "git-clone-failed");
        if (requestedRef) {
          await runGit(["-C", request.installRoot, "checkout", requestedRef], "git-checkout-failed");
        }
      } else if (status.status === "installed" && request.allowUpdate) {
        await runGit(["-C", request.installRoot, "fetch", "--all", "--tags"], "git-fetch-failed");
        if (requestedRef) {
          await runGit(["-C", request.installRoot, "checkout", requestedRef], "git-checkout-failed");
        }
        await runGit(["-C", request.installRoot, "pull", "--ff-only"], "git-pull-failed");
      }

      const revParse = await runGit(["-C", request.installRoot, "rev-parse", "HEAD"], "git-rev-parse-failed");
      const commitSha = revParse.stdout.trim();
      const metadata: RuntimeInstallMetadata = {
      managedBy: "ai-system-builder",
      targetId: request.targetId,
      installRoot: request.installRoot,
      source: request.source,
      requestedRef,
      resolvedRef: requestedRef,
      commitSha,
      installedAt,
      lastCheckedAt: installedAt,
    };
      await writeMetadata(metadata);

      return {
        targetId: request.targetId,
        status: "installed",
        installRoot: request.installRoot,
        source: request.source,
        requestedRef,
        resolvedRef: requestedRef,
        commitSha,
        installedAt,
        lastCheckedAt: installedAt,
      };
    } catch (error) {
      return {
        targetId: request.targetId,
        status: "failed",
        installRoot: request.installRoot,
        source: request.source,
        error: error as RuntimeInstallResult["error"],
      };
    }
  }

  async function repairInstall(request: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const status = await getInstallStatus(request);
    if (status.status !== "installed") {
      return {
        targetId: request.targetId,
        status: "failed",
        installRoot: request.installRoot,
        source: request.source,
        error: status.error ?? makeError("unmanaged-install-root", "Install cannot be repaired because it is unmanaged"),
      };
    }
    return ensureInstalled({ ...request, allowUpdate: true });
  }

  return { getInstallStatus, ensureInstalled, repairInstall };
}
