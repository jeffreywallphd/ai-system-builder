import { execFile } from "node:child_process";
import { mkdirSync, existsSync, rmSync, readdirSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  RuntimeRepositoryInstallerKinds,
  RuntimeRepositoryInstallationStates,
  createInstalledRuntimeRepositoryMetadata,
  createRuntimeRepositoryDiagnosticsRequest,
  createRuntimeRepositoryInstallLocation,
  createRuntimeRepositoryInstallLocationKey,
  createRuntimeRepositoryInstallLocationRequest,
  createRuntimeRepositoryInstallRequest,
  createRuntimeRepositoryIssue,
  createRuntimeRepositoryOperationError,
  createRuntimeRepositoryStatusRequest,
  createRuntimeRepositoryUpdateRequest,
  createRuntimeRepositoryValidationRequest,
  type IRuntimeRepositoryInstallerContract,
  type InstalledRuntimeRepositoryMetadata,
  type RuntimeRepositoryDiagnosticsRequest,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryInstallLocation,
  type RuntimeRepositoryInstallLocationRequest,
  type RuntimeRepositoryInstallRequest,
  type RuntimeRepositoryInstallResult,
  type RuntimeRepositoryOperationError,
  type RuntimeRepositorySourceMetadata,
  type RuntimeRepositoryStatusRequest,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryUpdateRequest,
  type RuntimeRepositoryUpdateResult,
  type RuntimeRepositoryValidationRequest,
  type RuntimeRepositoryValidationResult,
} from "@application/runtime/RuntimeRepositoryInstallerContract";

const DEFAULT_METADATA_FILENAME = ".ai-loom-runtime-repository-install.json";
const execFileAsync = promisify(execFile);

interface GitCommandRecord {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GitCommandRunner {
  run(command: string, args: ReadonlyArray<string>, options?: { readonly cwd?: string }): Promise<GitCommandRecord>;
}

export interface GitRuntimeRepositoryInstallerOptions {
  readonly commandRunner?: GitCommandRunner;
  readonly now?: () => Date;
  readonly metadataFilename?: string;
}

export class GitRuntimeRepositoryInstaller implements IRuntimeRepositoryInstallerContract {
  private readonly commandRunner: GitCommandRunner;
  private readonly now: () => Date;
  private readonly metadataFilename: string;

  public constructor(options: GitRuntimeRepositoryInstallerOptions = {}) {
    this.commandRunner = options.commandRunner ?? new NodeGitCommandRunner();
    this.now = options.now ?? (() => new Date());
    this.metadataFilename = options.metadataFilename?.trim() || DEFAULT_METADATA_FILENAME;
  }

  public resolveInstallLocation(request: RuntimeRepositoryInstallLocationRequest): RuntimeRepositoryInstallLocation {
    const normalized = createRuntimeRepositoryInstallLocationRequest({
      runtimeDependencyId: request.runtimeDependencyId,
      installerKind: request.installerKind,
      source: request.source,
      targetRootDirectory: request.targetRootDirectory,
      installLocationKey: request.installLocationKey,
    });
    const installLocationKey = normalized.installLocationKey ?? createRuntimeRepositoryInstallLocationKey({
      runtimeDependencyId: normalized.runtimeDependencyId,
      installerKind: normalized.installerKind,
      source: normalized.source,
    });
    const directoryName = sanitizeLocationKey(installLocationKey);

    return createRuntimeRepositoryInstallLocation({
      installLocationKey,
      installDirectory: path.join(normalized.targetRootDirectory, directoryName),
      targetRootDirectory: normalized.targetRootDirectory,
    });
  }

  public async install(request: RuntimeRepositoryInstallRequest): Promise<RuntimeRepositoryInstallResult> {
    const normalized = createRuntimeRepositoryInstallRequest(request);
    const installLocation = this.resolveInstallLocation(normalized);
    mkdirSync(installLocation.targetRootDirectory, { recursive: true });

    let recoveredFromPartial = false;
    let stagedDirectory: string | undefined;
    try {
      this.cleanupStaleStagingDirectories(installLocation);
      if (existsSync(installLocation.installDirectory)) {
        if (this.isGitRepositoryDirectory(installLocation.installDirectory)) {
          const installed = await this.readOrCreateInstalledMetadata({
            runtimeDependencyId: normalized.runtimeDependencyId,
            installerKind: normalized.installerKind,
            source: normalized.source,
            installLocation,
            metadata: normalized.metadata,
          });
          return Object.freeze({
            success: true,
            operation: "already-installed",
            installed,
            recoveredFromPartial: false,
            issues: Object.freeze([]),
          });
        }

        if (!normalized.allowRecovery) {
          return Object.freeze({
            success: false,
            operation: "failed",
            recoveredFromPartial: false,
            error: createRuntimeRepositoryOperationError({
              code: "partial-install-detected",
              message: "Install directory exists but is not a valid repository.",
              retryable: true,
              metadata: Object.freeze({
                installDirectory: installLocation.installDirectory,
              }),
            }),
            issues: Object.freeze([createRuntimeRepositoryIssue({
              code: "partial-install-detected",
              severity: "error",
              message: "Existing install directory is incomplete and recovery is disabled.",
            })]),
          });
        }

        rmSync(installLocation.installDirectory, { recursive: true, force: true });
        recoveredFromPartial = true;
      }

      stagedDirectory = `${installLocation.installDirectory}.staging-${Date.now().toString(36)}`;
      await this.runGit([
        "clone",
        "--origin",
        "origin",
        normalized.source.repositoryUri,
        stagedDirectory,
      ]);

      if (normalized.source.requestedRevision) {
        await this.runGit(["-C", stagedDirectory, "checkout", normalized.source.requestedRevision]);
      }

      const resolvedRevision = await this.resolveHeadRevision(stagedDirectory);
      renameSync(stagedDirectory, installLocation.installDirectory);
      stagedDirectory = undefined;

      const installed = this.createInstalledMetadata({
        runtimeDependencyId: normalized.runtimeDependencyId,
        installerKind: normalized.installerKind,
        source: normalized.source,
        installLocation,
        resolvedRevision,
        metadata: normalized.metadata,
      });
      this.writeInstalledMetadata(installed);

      return Object.freeze({
        success: true,
        operation: "installed",
        installed,
        recoveredFromPartial,
        issues: Object.freeze([]),
      });
    } catch (error) {
      if (stagedDirectory && existsSync(stagedDirectory)) {
        rmSync(stagedDirectory, { recursive: true, force: true });
      }
      return Object.freeze({
        success: false,
        operation: "failed",
        recoveredFromPartial,
        error: toOperationError(error),
        issues: Object.freeze([createRuntimeRepositoryIssue({
          code: "install-failed",
          severity: "error",
          message: error instanceof Error ? error.message : "Repository install failed.",
        })]),
      });
    }
  }

  public async update(request: RuntimeRepositoryUpdateRequest): Promise<RuntimeRepositoryUpdateResult> {
    const normalized = createRuntimeRepositoryUpdateRequest(request);
    const installLocation = this.resolveInstallLocation({
      runtimeDependencyId: normalized.runtimeDependencyId,
      installerKind: normalized.installerKind,
      source: normalized.source,
      targetRootDirectory: normalized.targetRootDirectory,
      installLocationKey: normalized.installLocationKey,
    });

    if (!this.isGitRepositoryDirectory(installLocation.installDirectory)) {
      const issue = createRuntimeRepositoryIssue({
        code: "repository-not-installed",
        severity: "error",
        message: "Cannot update a repository that is not installed.",
      });
      return Object.freeze({
        success: false,
        operation: "failed",
        updated: false,
        error: createRuntimeRepositoryOperationError({
          code: "repository-not-installed",
          message: issue.message,
          retryable: false,
          metadata: Object.freeze({
            installDirectory: installLocation.installDirectory,
          }),
        }),
        issues: Object.freeze([issue]),
      });
    }

    try {
      const beforeRevision = await this.resolveHeadRevision(installLocation.installDirectory);
      await this.runGit(["-C", installLocation.installDirectory, "fetch", "--all", "--prune"]);
      if (normalized.source.requestedRevision) {
        await this.runGit(["-C", installLocation.installDirectory, "checkout", normalized.source.requestedRevision]);
      } else {
        await this.runGit(["-C", installLocation.installDirectory, "pull", "--ff-only"]);
      }
      const afterRevision = await this.resolveHeadRevision(installLocation.installDirectory);
      const updated = beforeRevision !== afterRevision;
      const installed = this.createInstalledMetadata({
        runtimeDependencyId: normalized.runtimeDependencyId,
        installerKind: normalized.installerKind,
        source: normalized.source,
        installLocation,
        resolvedRevision: afterRevision,
        metadata: normalized.metadata,
      });
      this.writeInstalledMetadata(installed);

      return Object.freeze({
        success: true,
        operation: updated ? "updated" : "already-current",
        updated,
        beforeRevision,
        afterRevision,
        installed,
        issues: Object.freeze([]),
      });
    } catch (error) {
      return Object.freeze({
        success: false,
        operation: "failed",
        updated: false,
        error: toOperationError(error),
        issues: Object.freeze([createRuntimeRepositoryIssue({
          code: "update-failed",
          severity: "error",
          message: error instanceof Error ? error.message : "Repository update failed.",
        })]),
      });
    }
  }

  public async inspectStatus(request: RuntimeRepositoryStatusRequest): Promise<RuntimeRepositoryStatusResult> {
    const normalized = createRuntimeRepositoryStatusRequest(request);
    const installLocation = this.resolveInstallLocation({
      runtimeDependencyId: normalized.runtimeDependencyId,
      installerKind: normalized.installerKind,
      source: normalized.source,
      targetRootDirectory: normalized.targetRootDirectory,
      installLocationKey: normalized.installLocationKey,
    });

    if (!existsSync(installLocation.installDirectory)) {
      return Object.freeze({
        state: RuntimeRepositoryInstallationStates.notInstalled,
        installLocation,
        issues: Object.freeze([]),
      });
    }

    if (!this.isGitRepositoryDirectory(installLocation.installDirectory)) {
      return Object.freeze({
        state: RuntimeRepositoryInstallationStates.partiallyInstalled,
        installLocation,
        issues: Object.freeze([createRuntimeRepositoryIssue({
          code: "partial-install-detected",
          severity: "error",
          message: "Install directory exists but .git metadata is missing.",
        })]),
      });
    }

    try {
      const installed = await this.readOrCreateInstalledMetadata({
        runtimeDependencyId: normalized.runtimeDependencyId,
        installerKind: normalized.installerKind,
        source: normalized.source,
        installLocation,
        metadata: {},
      });
      return Object.freeze({
        state: RuntimeRepositoryInstallationStates.installed,
        installLocation,
        installed,
        issues: Object.freeze([]),
      });
    } catch (error) {
      return Object.freeze({
        state: RuntimeRepositoryInstallationStates.invalid,
        installLocation,
        issues: Object.freeze([createRuntimeRepositoryIssue({
          code: "status-read-failed",
          severity: "error",
          message: error instanceof Error ? error.message : "Failed to inspect repository status.",
        })]),
      });
    }
  }

  public async validate(request: RuntimeRepositoryValidationRequest): Promise<RuntimeRepositoryValidationResult> {
    const normalized = createRuntimeRepositoryValidationRequest(request);
    const status = await this.inspectStatus(normalized);
    const issues = [...status.issues];

    if (!status.installed) {
      issues.push(createRuntimeRepositoryIssue({
        code: "repository-not-installed",
        severity: "error",
        message: "Repository is not installed.",
      }));
      return Object.freeze({
        valid: false,
        status,
        issues: Object.freeze(issues),
      });
    }

    if (normalized.expectedRevision && status.installed.resolvedRevision !== normalized.expectedRevision) {
      issues.push(createRuntimeRepositoryIssue({
        code: "revision-mismatch",
        severity: "error",
        message: `Expected revision '${normalized.expectedRevision}' but found '${status.installed.resolvedRevision ?? "unknown"}'.`,
      }));
    }

    try {
      const remoteResult = await this.runGit(["-C", status.installed.installLocation.installDirectory, "config", "--get", "remote.origin.url"]);
      const remoteUri = remoteResult.stdout.trim();
      if (remoteUri && remoteUri !== normalized.source.repositoryUri) {
        issues.push(createRuntimeRepositoryIssue({
          code: "repository-uri-mismatch",
          severity: "error",
          message: `Expected repository URI '${normalized.source.repositoryUri}' but found '${remoteUri}'.`,
        }));
      }
    } catch {
      issues.push(createRuntimeRepositoryIssue({
        code: "repository-uri-read-failed",
        severity: "warning",
        message: "Unable to verify remote origin URL.",
      }));
    }

    return Object.freeze({
      valid: !issues.some((issue) => issue.severity === "error"),
      status,
      issues: Object.freeze(issues),
    });
  }

  public async collectDiagnostics(request: RuntimeRepositoryDiagnosticsRequest): Promise<RuntimeRepositoryDiagnosticsResult> {
    const normalized = createRuntimeRepositoryDiagnosticsRequest(request);
    const status = await this.inspectStatus(normalized);
    const commandDiagnostics: GitCommandRecord[] = [];
    const issues = [...status.issues];

    if (normalized.includeCommandDiagnostics && status.installed) {
      for (const args of [
        ["-C", status.installed.installLocation.installDirectory, "status", "--short", "--branch"],
        ["-C", status.installed.installLocation.installDirectory, "remote", "-v"],
      ]) {
        try {
          commandDiagnostics.push(await this.runGit(args));
        } catch (error) {
          issues.push(createRuntimeRepositoryIssue({
            code: "diagnostic-command-failed",
            severity: "warning",
            message: error instanceof Error ? error.message : "Git diagnostic command failed.",
          }));
        }
      }
    }

    return Object.freeze({
      status,
      commandDiagnostics: Object.freeze(commandDiagnostics),
      issues: Object.freeze(issues),
    });
  }

  private cleanupStaleStagingDirectories(installLocation: RuntimeRepositoryInstallLocation): void {
    const parent = path.dirname(installLocation.installDirectory);
    const baseName = path.basename(installLocation.installDirectory);
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!entry.name.startsWith(`${baseName}.staging-`)) {
        continue;
      }
      rmSync(path.join(parent, entry.name), { recursive: true, force: true });
    }
  }

  private isGitRepositoryDirectory(directoryPath: string): boolean {
    return existsSync(path.join(directoryPath, ".git"));
  }

  private getMetadataPath(installLocation: RuntimeRepositoryInstallLocation): string {
    return path.join(installLocation.installDirectory, this.metadataFilename);
  }

  private async readOrCreateInstalledMetadata(input: {
    readonly runtimeDependencyId: string;
    readonly installerKind: string;
    readonly source: RuntimeRepositorySourceMetadata;
    readonly installLocation: RuntimeRepositoryInstallLocation;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<InstalledRuntimeRepositoryMetadata> {
    const metadataPath = this.getMetadataPath(input.installLocation);
    if (existsSync(metadataPath)) {
      const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as InstalledRuntimeRepositoryMetadata;
      const currentRevision = await this.resolveHeadRevision(input.installLocation.installDirectory).catch(() => parsed.resolvedRevision);
      return createInstalledRuntimeRepositoryMetadata({
        ...parsed,
        resolvedRevision: currentRevision,
        updatedAt: this.now().toISOString(),
      });
    }

    const resolvedRevision = await this.resolveHeadRevision(input.installLocation.installDirectory);
    const installed = this.createInstalledMetadata({
      runtimeDependencyId: input.runtimeDependencyId,
      installerKind: input.installerKind,
      source: input.source,
      installLocation: input.installLocation,
      resolvedRevision,
      metadata: input.metadata,
    });
    this.writeInstalledMetadata(installed);
    return installed;
  }

  private createInstalledMetadata(input: {
    readonly runtimeDependencyId: string;
    readonly installerKind: string;
    readonly source: RuntimeRepositorySourceMetadata;
    readonly installLocation: RuntimeRepositoryInstallLocation;
    readonly resolvedRevision?: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): InstalledRuntimeRepositoryMetadata {
    const nowIso = this.now().toISOString();
    const existing = this.readInstalledMetadata(input.installLocation);
    return createInstalledRuntimeRepositoryMetadata({
      runtimeDependencyId: input.runtimeDependencyId,
      installerKind: input.installerKind,
      source: input.source,
      installLocation: input.installLocation,
      resolvedRevision: input.resolvedRevision,
      installedAt: existing?.installedAt ?? nowIso,
      updatedAt: nowIso,
      metadata: {
        ...existing?.metadata,
        ...input.metadata,
      },
    });
  }

  private readInstalledMetadata(installLocation: RuntimeRepositoryInstallLocation): InstalledRuntimeRepositoryMetadata | undefined {
    const metadataPath = this.getMetadataPath(installLocation);
    if (!existsSync(metadataPath)) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as InstalledRuntimeRepositoryMetadata;
      return createInstalledRuntimeRepositoryMetadata(parsed);
    } catch {
      return undefined;
    }
  }

  private writeInstalledMetadata(installed: InstalledRuntimeRepositoryMetadata): void {
    const metadataPath = this.getMetadataPath(installed.installLocation);
    writeFileSync(metadataPath, JSON.stringify(installed, null, 2), "utf8");
  }

  private async resolveHeadRevision(repositoryDirectory: string): Promise<string> {
    const result = await this.runGit(["-C", repositoryDirectory, "rev-parse", "HEAD"]);
    return result.stdout.trim();
  }

  private async runGit(args: ReadonlyArray<string>): Promise<GitCommandRecord> {
    const result = await this.commandRunner.run("git", args);
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || "unknown git error";
      throw new Error(`git ${args.join(" ")} failed (${result.exitCode}): ${detail}`);
    }
    return result;
  }
}

class NodeGitCommandRunner implements GitCommandRunner {
  public async run(command: string, args: ReadonlyArray<string>, options: { readonly cwd?: string } = {}): Promise<GitCommandRecord> {
    try {
      const completed = await execFileAsync(command, [...args], {
        cwd: options.cwd,
        windowsHide: true,
      });
      return Object.freeze({
        command,
        args: Object.freeze([...args]),
        exitCode: 0,
        stdout: completed.stdout?.toString() ?? "",
        stderr: completed.stderr?.toString() ?? "",
      });
    } catch (error) {
      const commandError = error as {
        readonly code?: number;
        readonly stdout?: string | Buffer;
        readonly stderr?: string | Buffer;
        readonly message?: string;
      };
      return Object.freeze({
        command,
        args: Object.freeze([...args]),
        exitCode: typeof commandError.code === "number" ? commandError.code : 1,
        stdout: bufferToString(commandError.stdout),
        stderr: bufferToString(commandError.stderr) || commandError.message || "",
      });
    }
  }
}

function bufferToString(value: string | Buffer | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

function sanitizeLocationKey(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  if (!normalized) {
    throw new Error("Install location key cannot be empty.");
  }
  return normalized;
}

function toOperationError(error: unknown): RuntimeRepositoryOperationError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return createRuntimeRepositoryOperationError({
      code: typeof (error as { code: unknown }).code === "string" ? (error as { code: string }).code : "repository-operation-failed",
      message: String((error as { message: unknown }).message),
      retryable: false,
      metadata: {},
    });
  }

  return createRuntimeRepositoryOperationError({
    code: "repository-operation-failed",
    message: error instanceof Error ? error.message : "Runtime repository operation failed.",
    retryable: false,
    metadata: {},
  });
}

