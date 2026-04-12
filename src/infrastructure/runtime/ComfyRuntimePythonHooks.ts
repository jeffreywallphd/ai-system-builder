import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  type IComfyRuntimeDependencyInstallationHook,
  type IComfyRuntimeEnvironmentPreparationHook,
  type ComfyRuntimeOrchestrationContext,
  type ComfyRuntimeOrchestrationIssue,
  type ComfyRuntimeOrchestrationPhaseHookResult,
} from "@application/runtime/ComfyRuntimeInstallerOrchestrationService";
import {
  PythonDependencyInstallStatuses,
  PythonEnvironmentProvisioningStatuses,
  PythonRuntimeDetectionStates,
  createPythonDependencyInstallResult,
  createPythonDependencyInstallState,
  createPythonRuntimeCommandDiagnostic,
  createPythonRuntimeDetectionResult,
  createPythonRuntimeEnvironmentProvisioningResult,
  createPythonRuntimeProvisioningError,
  createPythonRuntimeProvisioningIssue,
  createPythonRuntimeRemediationHint,
  type PythonDependencyInstallState,
  type PythonRuntimeCommandDiagnostic,
  type PythonRuntimeDetectionResult,
  type PythonRuntimeEnvironmentProvisioningResult,
  type PythonRuntimeProvisioningIssue,
} from "@application/runtime/PythonRuntimeProvisioningContract";

const execFileAsync = promisify(execFile);
const ENVIRONMENT_STATE_FILENAME = ".ai-loom-comfy-python-environment.json";
const DEPENDENCY_STATE_FILENAME = ".ai-loom-comfy-python-dependencies.json";
const ENVIRONMENT_SCHEMA_VERSION = 1;
const PYTHON_VERSION_PROBE_SCRIPT = [
  "import json",
  "import platform",
  "import sys",
  "print(json.dumps({'version': platform.python_version(), 'executable': sys.executable}))",
].join(";");

interface PythonCommandRecord {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface PythonCommandRunner {
  run(command: string, args: ReadonlyArray<string>, options?: { readonly cwd?: string }): Promise<PythonCommandRecord>;
}

export interface ComfyRuntimePythonHooksOptions {
  readonly commandRunner?: PythonCommandRunner;
  readonly now?: () => Date;
  readonly pythonCandidates?: ReadonlyArray<string>;
}

interface ResolvedPythonEnvironment {
  readonly environmentDirectory: string;
  readonly pythonExecutable: string;
  readonly metadataPath: string;
  readonly dependencyStatePath: string;
}

interface ParsedVersionConstraint {
  readonly raw: string;
  readonly minimumMajor: number;
  readonly minimumMinor: number;
}

interface PersistedEnvironmentState {
  readonly schemaVersion: number;
  readonly status: "created" | "reused" | "recreated" | "failed";
  readonly requirement?: string;
  readonly sourceInterpreter?: string;
  readonly sourceVersion?: string;
  readonly environmentDirectory?: string;
  readonly pythonExecutable?: string;
  readonly pipBootstrapRepaired?: boolean;
  readonly updatedAt: string;
  readonly provisionedAt?: string;
  readonly issueCodes: ReadonlyArray<string>;
}

export class ComfyRuntimePythonHooks implements IComfyRuntimeEnvironmentPreparationHook, IComfyRuntimeDependencyInstallationHook {
  private readonly commandRunner: PythonCommandRunner;
  private readonly now: () => Date;
  private readonly pythonCandidates: ReadonlyArray<string>;

  public constructor(options: ComfyRuntimePythonHooksOptions = {}) {
    this.commandRunner = options.commandRunner ?? new NodePythonCommandRunner();
    this.now = options.now ?? (() => new Date());
    this.pythonCandidates = options.pythonCandidates && options.pythonCandidates.length > 0
      ? Object.freeze([...new Set(options.pythonCandidates.map((entry) => entry.trim()).filter(Boolean))])
      : Object.freeze(["python", "python3", "py"]);
  }

  public async prepare(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult> {
    const diagnostics: PythonRuntimeCommandDiagnostic[] = [];
    const issues: PythonRuntimeProvisioningIssue[] = [];
    const remediation: Array<ReturnType<typeof createPythonRuntimeRemediationHint>> = [];
    const requirement = this.resolvePythonRequirement(context);
    const detection = await this.detectPython(requirement, diagnostics, context.runtimeWorkingDirectory);

    if (detection.state !== PythonRuntimeDetectionStates.available || !detection.executablePath || !detection.version) {
      const error = createPythonRuntimeProvisioningError({
        code: detection.state === PythonRuntimeDetectionStates.incompatible
          ? "python-runtime-incompatible"
          : "python-runtime-missing",
        message: detection.state === PythonRuntimeDetectionStates.incompatible
          ? "Detected Python interpreter does not satisfy ComfyUI runtime requirements."
          : "Python interpreter for ComfyUI runtime is not available.",
        retryable: true,
        metadata: {
          requirement,
        },
      });
      const result = createPythonRuntimeEnvironmentProvisioningResult({
        status: PythonEnvironmentProvisioningStatuses.failed,
        detection,
        issues: detection.issues,
        diagnostics,
        remediation: Object.freeze([
          createPythonRuntimeRemediationHint({
            code: "install-compatible-python",
            description: "Install a compatible Python interpreter and rerun runtime provisioning.",
            metadata: {
              requirement,
            },
          }),
        ]),
        error,
      });
      this.persistEnvironmentState(context, {
        schemaVersion: ENVIRONMENT_SCHEMA_VERSION,
        status: "failed",
        requirement,
        sourceInterpreter: detection.executablePath,
        sourceVersion: detection.version,
        updatedAt: this.now().toISOString(),
        issueCodes: result.issues.map((entry) => entry.code),
      });
      return this.toPhaseResult("failed", "ComfyUI Python environment preparation failed.", result);
    }

    const environment = this.resolveEnvironment(context);
    const existingEnvironment = this.isReusableEnvironment(environment);
    let recreateRequired = false;
    let recoveredFromPartial = false;

    if (existingEnvironment) {
      const pipIntegrity = await this.ensurePipIntegrity(environment.pythonExecutable, context.runtimeWorkingDirectory, diagnostics);
      if (!pipIntegrity.ok) {
        recreateRequired = true;
        issues.push(createPythonRuntimeProvisioningIssue({
          code: "python-environment-pip-corrupted",
          severity: "warning",
          message: "Existing Python environment has broken pip and will be recreated.",
          metadata: {
            environmentDirectory: environment.environmentDirectory,
          },
        }));
        remediation.push(createPythonRuntimeRemediationHint({
          code: "environment-recreated",
          description: "Environment was marked unrecoverable and recreated deterministically.",
          metadata: {
            environmentDirectory: environment.environmentDirectory,
          },
        }));
      }
    } else if (existsSync(environment.environmentDirectory)) {
      recreateRequired = true;
      recoveredFromPartial = true;
      issues.push(createPythonRuntimeProvisioningIssue({
        code: "python-environment-partial-detected",
        severity: "warning",
        message: "Partial Python environment detected; provisioning will recreate it.",
        metadata: {
          environmentDirectory: environment.environmentDirectory,
        },
      }));
    }

    let status: PythonRuntimeEnvironmentProvisioningResult["status"];
    try {
      if (!existingEnvironment || recreateRequired) {
        this.cleanupStaleStagingDirectories(environment.environmentDirectory);
        if (existsSync(environment.environmentDirectory)) {
          rmSync(environment.environmentDirectory, { recursive: true, force: true });
        }
        const stagedDirectory = `${environment.environmentDirectory}.staging-${Date.now().toString(36)}`;
        const createResult = await this.commandRunner.run(detection.executablePath, ["-m", "venv", stagedDirectory], {
          cwd: context.runtimeWorkingDirectory,
        });
        diagnostics.push(createPythonRuntimeCommandDiagnostic(createResult));
        if (createResult.exitCode !== 0) {
          throw new Error(`python -m venv failed: ${this.normalizeCommandFailure(createResult)}`);
        }
        renameSync(stagedDirectory, environment.environmentDirectory);
        status = recreateRequired ? PythonEnvironmentProvisioningStatuses.recreated : PythonEnvironmentProvisioningStatuses.created;
      } else {
        status = PythonEnvironmentProvisioningStatuses.reused;
      }

      const pipIntegrity = await this.ensurePipIntegrity(environment.pythonExecutable, context.runtimeWorkingDirectory, diagnostics);
      if (!pipIntegrity.ok) {
        throw new Error("pip bootstrap failed in provisioned environment.");
      }

      const result = createPythonRuntimeEnvironmentProvisioningResult({
        status,
        detection,
        environment: {
          environmentDirectory: environment.environmentDirectory,
          pythonExecutable: environment.pythonExecutable,
          sourceInterpreter: detection.executablePath,
          metadataPath: environment.metadataPath,
        },
        issues,
        diagnostics,
        remediation: remediation,
      });
      this.persistEnvironmentState(context, {
        schemaVersion: ENVIRONMENT_SCHEMA_VERSION,
        status: status === PythonEnvironmentProvisioningStatuses.recreated ? "recreated" : status,
        requirement,
        sourceInterpreter: detection.executablePath,
        sourceVersion: detection.version,
        environmentDirectory: environment.environmentDirectory,
        pythonExecutable: environment.pythonExecutable,
        pipBootstrapRepaired: pipIntegrity.repaired,
        updatedAt: this.now().toISOString(),
        provisionedAt: this.now().toISOString(),
        issueCodes: [...new Set([
          ...(recoveredFromPartial ? ["python-environment-partial-detected"] : []),
          ...result.issues.map((entry) => entry.code),
        ])],
      });
      return this.toPhaseResult("completed", `ComfyUI Python environment ${status}.`, result);
    } catch (error) {
      const errorObject = createPythonRuntimeProvisioningError({
        code: "python-environment-provisioning-failed",
        message: error instanceof Error ? error.message : "Python environment provisioning failed.",
        retryable: true,
        metadata: {
          environmentDirectory: environment.environmentDirectory,
        },
      });
      const result = createPythonRuntimeEnvironmentProvisioningResult({
        status: PythonEnvironmentProvisioningStatuses.failed,
        detection,
        environment: {
          environmentDirectory: environment.environmentDirectory,
          pythonExecutable: environment.pythonExecutable,
          sourceInterpreter: detection.executablePath,
          metadataPath: environment.metadataPath,
        },
        issues: [
          ...issues,
          createPythonRuntimeProvisioningIssue({
            code: "python-environment-provisioning-failed",
            severity: "error",
            message: errorObject.message,
            metadata: errorObject.metadata,
          }),
        ],
        diagnostics,
        remediation: [
          ...remediation,
          createPythonRuntimeRemediationHint({
            code: "retry-environment-provisioning",
            description: "Retry environment provisioning after verifying Python installation and write permissions.",
            metadata: {
              environmentDirectory: environment.environmentDirectory,
            },
          }),
        ],
        error: errorObject,
      });
      this.persistEnvironmentState(context, {
        schemaVersion: ENVIRONMENT_SCHEMA_VERSION,
        status: "failed",
        requirement,
        sourceInterpreter: detection.executablePath,
        sourceVersion: detection.version,
        environmentDirectory: environment.environmentDirectory,
        pythonExecutable: environment.pythonExecutable,
        updatedAt: this.now().toISOString(),
        issueCodes: result.issues.map((entry) => entry.code),
      });
      return this.toPhaseResult("failed", "ComfyUI Python environment preparation failed.", result);
    }
  }

  public async installDependencies(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult> {
    const diagnostics: PythonRuntimeCommandDiagnostic[] = [];
    const issues: PythonRuntimeProvisioningIssue[] = [];
    const requirementSource = this.resolveDependencyRequirement(context);
    const environment = this.resolveEnvironment(context);
    const startedAt = this.now().toISOString();
    const previousState = this.readDependencyInstallState(environment.dependencyStatePath);

    if (previousState?.status === PythonDependencyInstallStatuses.failed) {
      issues.push(createPythonRuntimeProvisioningIssue({
        code: "dependency-install-partial-state-detected",
        severity: "warning",
        message: "Previous dependency installation attempt failed; retrying safely.",
        metadata: {
          previousAttemptAt: previousState.completedAt ?? previousState.startedAt,
        },
      }));
    }

    if (!existsSync(environment.pythonExecutable)) {
      const failed = this.persistDependencyState({
        dependencyStatePath: environment.dependencyStatePath,
        state: createPythonDependencyInstallState({
          schemaVersion: 1,
          status: PythonDependencyInstallStatuses.failed,
          startedAt,
          completedAt: this.now().toISOString(),
          lastAttemptedStep: "resolve-environment",
          dependencySource: requirementSource,
          environmentDirectory: environment.environmentDirectory,
          stdout: "",
          stderr: "Python environment executable not found.",
          issueCodes: ["python-environment-missing"],
          remediation: [
            createPythonRuntimeRemediationHint({
              code: "rerun-environment-phase",
              description: "Run ComfyUI environment provisioning before installing dependencies.",
              metadata: {
                environmentDirectory: environment.environmentDirectory,
              },
            }),
          ],
          metadata: {},
        }),
      });
      const result = createPythonDependencyInstallResult({
        status: PythonDependencyInstallStatuses.failed,
        state: failed,
        issues: [
          ...issues,
          createPythonRuntimeProvisioningIssue({
            code: "python-environment-missing",
            severity: "error",
            message: "Python environment is not provisioned for dependency installation.",
            metadata: {
              environmentDirectory: environment.environmentDirectory,
            },
          }),
        ],
        diagnostics,
        error: createPythonRuntimeProvisioningError({
          code: "python-environment-missing",
          message: "Python environment is not provisioned for dependency installation.",
          retryable: true,
          metadata: {
            environmentDirectory: environment.environmentDirectory,
          },
        }),
      });
      return this.toDependencyPhaseResult("failed", "ComfyUI dependency installation failed: environment missing.", result);
    }

    const requirementsPath = this.resolveRequirementsPath(context, requirementSource);
    if (!requirementsPath) {
      const failed = this.persistDependencyState({
        dependencyStatePath: environment.dependencyStatePath,
        state: createPythonDependencyInstallState({
          schemaVersion: 1,
          status: PythonDependencyInstallStatuses.failed,
          startedAt,
          completedAt: this.now().toISOString(),
          lastAttemptedStep: "resolve-requirements",
          dependencySource: requirementSource,
          environmentDirectory: environment.environmentDirectory,
          stdout: "",
          stderr: "ComfyUI requirements file was not found.",
          issueCodes: ["dependency-requirements-missing"],
          remediation: [
            createPythonRuntimeRemediationHint({
              code: "validate-runtime-repository",
              description: "Verify ComfyUI repository installation and ensure requirements files exist.",
              metadata: {
                runtimeWorkingDirectory: context.runtimeWorkingDirectory,
              },
            }),
          ],
          metadata: {},
        }),
      });
      const result = createPythonDependencyInstallResult({
        status: PythonDependencyInstallStatuses.failed,
        state: failed,
        issues: [
          ...issues,
          createPythonRuntimeProvisioningIssue({
            code: "dependency-requirements-missing",
            severity: "error",
            message: "ComfyUI dependency requirements file is missing.",
            metadata: {
              runtimeWorkingDirectory: context.runtimeWorkingDirectory,
              requirementSource,
            },
          }),
        ],
        diagnostics,
        error: createPythonRuntimeProvisioningError({
          code: "dependency-requirements-missing",
          message: "ComfyUI dependency requirements file is missing.",
          retryable: true,
          metadata: {
            runtimeWorkingDirectory: context.runtimeWorkingDirectory,
            requirementSource,
          },
        }),
      });
      return this.toDependencyPhaseResult("failed", "ComfyUI dependency installation failed: requirements file missing.", result);
    }

    const startedState = this.persistDependencyState({
      dependencyStatePath: environment.dependencyStatePath,
      state: createPythonDependencyInstallState({
        schemaVersion: 1,
        status: PythonDependencyInstallStatuses.started,
        startedAt,
        lastAttemptedStep: "install-requirements",
        dependencySource: requirementSource,
        environmentDirectory: environment.environmentDirectory,
        requirementsPath,
        stdout: "",
        stderr: "",
        issueCodes: issues.map((entry) => entry.code),
        remediation: [],
        metadata: {},
      }),
    });

    const pipIntegrity = await this.ensurePipIntegrity(environment.pythonExecutable, context.runtimeWorkingDirectory, diagnostics);
    if (!pipIntegrity.ok) {
      const failedState = this.persistDependencyState({
        dependencyStatePath: environment.dependencyStatePath,
        state: createPythonDependencyInstallState({
          ...startedState,
          status: PythonDependencyInstallStatuses.failed,
          completedAt: this.now().toISOString(),
          lastAttemptedStep: "bootstrap-pip",
          stderr: "pip bootstrap validation failed before dependency installation.",
          issueCodes: [...new Set([...startedState.issueCodes, "dependency-pip-bootstrap-failed"])],
          remediation: [
            createPythonRuntimeRemediationHint({
              code: "repair-or-recreate-environment",
              description: "Re-run environment provisioning to repair pip before dependency install.",
              metadata: {
                environmentDirectory: environment.environmentDirectory,
              },
            }),
          ],
        }),
      });
      const result = createPythonDependencyInstallResult({
        status: PythonDependencyInstallStatuses.failed,
        state: failedState,
        issues: [
          ...issues,
          createPythonRuntimeProvisioningIssue({
            code: "dependency-pip-bootstrap-failed",
            severity: "error",
            message: "pip bootstrap validation failed before dependency installation.",
            metadata: {
              environmentDirectory: environment.environmentDirectory,
            },
          }),
        ],
        diagnostics,
        error: createPythonRuntimeProvisioningError({
          code: "dependency-pip-bootstrap-failed",
          message: "pip bootstrap validation failed before dependency installation.",
          retryable: true,
          metadata: {
            environmentDirectory: environment.environmentDirectory,
          },
        }),
      });
      return this.toDependencyPhaseResult("failed", "ComfyUI dependency installation failed: pip bootstrap failed.", result);
    }

    const installResult = await this.commandRunner.run(environment.pythonExecutable, ["-m", "pip", "install", "-r", requirementsPath], {
      cwd: context.runtimeWorkingDirectory,
    });
    diagnostics.push(createPythonRuntimeCommandDiagnostic(installResult));

    if (installResult.exitCode !== 0) {
      const failedState = this.persistDependencyState({
        dependencyStatePath: environment.dependencyStatePath,
        state: createPythonDependencyInstallState({
          ...startedState,
          status: PythonDependencyInstallStatuses.failed,
          completedAt: this.now().toISOString(),
          lastAttemptedStep: "install-requirements",
          stdout: installResult.stdout,
          stderr: installResult.stderr,
          issueCodes: [...new Set([...startedState.issueCodes, "dependency-install-failed"])],
          remediation: [
            createPythonRuntimeRemediationHint({
              code: "retry-pip-install",
              description: "Retry dependency installation; if persistent, inspect pip stderr for package conflicts.",
              metadata: {
                requirementsPath,
              },
            }),
          ],
        }),
      });
      const result = createPythonDependencyInstallResult({
        status: PythonDependencyInstallStatuses.failed,
        state: failedState,
        issues: [
          ...issues,
          createPythonRuntimeProvisioningIssue({
            code: "dependency-install-failed",
            severity: "error",
            message: "ComfyUI dependency installation failed.",
            metadata: {
              requirementsPath,
              summary: this.normalizeCommandFailure(installResult),
            },
          }),
        ],
        diagnostics,
        error: createPythonRuntimeProvisioningError({
          code: "dependency-install-failed",
          message: "ComfyUI dependency installation failed.",
          retryable: true,
          metadata: {
            requirementsPath,
            summary: this.normalizeCommandFailure(installResult),
          },
        }),
      });
      return this.toDependencyPhaseResult("failed", "ComfyUI dependency installation failed.", result);
    }

    const completedState = this.persistDependencyState({
      dependencyStatePath: environment.dependencyStatePath,
      state: createPythonDependencyInstallState({
        ...startedState,
        status: PythonDependencyInstallStatuses.completed,
        completedAt: this.now().toISOString(),
        lastAttemptedStep: "completed",
        stdout: installResult.stdout,
        stderr: installResult.stderr,
        issueCodes: issues.map((entry) => entry.code),
        remediation: [],
      }),
    });
    const result = createPythonDependencyInstallResult({
      status: PythonDependencyInstallStatuses.completed,
      state: completedState,
      issues,
      diagnostics,
    });
    return this.toDependencyPhaseResult("completed", "ComfyUI dependencies installed.", result);
  }

  private toPhaseResult(
    status: "completed" | "failed",
    message: string,
    result: PythonRuntimeEnvironmentProvisioningResult,
  ): ComfyRuntimeOrchestrationPhaseHookResult {
    return Object.freeze({
      status,
      message,
      issues: Object.freeze(result.issues.map((entry) => this.toOrchestrationIssue("environment", entry))),
      metadata: Object.freeze({
        environmentProvisioning: result,
      }),
    });
  }

  private toDependencyPhaseResult(
    status: "completed" | "failed",
    message: string,
    result: ReturnType<typeof createPythonDependencyInstallResult>,
  ): ComfyRuntimeOrchestrationPhaseHookResult {
    return Object.freeze({
      status,
      message,
      issues: Object.freeze(result.issues.map((entry) => this.toOrchestrationIssue("dependencies", entry))),
      metadata: Object.freeze({
        dependencyInstallation: result,
      }),
    });
  }

  private toOrchestrationIssue(phase: string, issue: PythonRuntimeProvisioningIssue): ComfyRuntimeOrchestrationIssue {
    return Object.freeze({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      phase,
      metadata: issue.metadata,
    });
  }

  private resolveEnvironment(context: ComfyRuntimeOrchestrationContext): ResolvedPythonEnvironment {
    const environmentDirectory = path.join(context.installDirectory, ".venv");
    const pythonExecutable = process.platform === "win32"
      ? path.join(environmentDirectory, "Scripts", "python.exe")
      : path.join(environmentDirectory, "bin", "python");
    return Object.freeze({
      environmentDirectory,
      pythonExecutable,
      metadataPath: path.join(environmentDirectory, ENVIRONMENT_STATE_FILENAME),
      dependencyStatePath: path.join(context.installDirectory, DEPENDENCY_STATE_FILENAME),
    });
  }

  private resolvePythonRequirement(context: ComfyRuntimeOrchestrationContext): string | undefined {
    const requirement = context.runtimeAsset.installRequirements.find((entry) => entry.category === "python" && entry.required);
    return requirement?.requirementRef.trim() || undefined;
  }

  private resolveDependencyRequirement(context: ComfyRuntimeOrchestrationContext): string {
    const requirement = context.runtimeAsset.installRequirements.find((entry) => entry.category === "pip" && entry.required);
    return requirement?.requirementRef.trim() || "requirements.txt";
  }

  private resolveRequirementsPath(context: ComfyRuntimeOrchestrationContext, requirementRef: string): string | undefined {
    const candidates = requirementRef
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(context.runtimeWorkingDirectory, entry));
    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return undefined;
  }

  private async detectPython(
    requirement: string | undefined,
    diagnostics: PythonRuntimeCommandDiagnostic[],
    cwd: string,
  ): Promise<PythonRuntimeDetectionResult> {
    const constraint = this.parseVersionConstraint(requirement);
    const candidates = [...this.pythonCandidates];
    for (const command of candidates) {
      const args = command === "py"
        ? ["-3", "-c", PYTHON_VERSION_PROBE_SCRIPT]
        : ["-c", PYTHON_VERSION_PROBE_SCRIPT];
      const result = await this.commandRunner.run(command, args, { cwd });
      diagnostics.push(createPythonRuntimeCommandDiagnostic(result));
      if (result.exitCode !== 0) {
        continue;
      }

      const parsed = parsePythonProbe(result.stdout);
      if (!parsed?.version || !parsed.executable) {
        continue;
      }

      if (constraint && !this.satisfiesMinimumVersion(parsed.version, constraint)) {
        return createPythonRuntimeDetectionResult({
          state: PythonRuntimeDetectionStates.incompatible,
          requirement: constraint.raw,
          command,
          executablePath: parsed.executable,
          version: parsed.version,
          diagnostics,
          issues: [
            createPythonRuntimeProvisioningIssue({
              code: "python-runtime-version-incompatible",
              severity: "error",
              message: `Python version '${parsed.version}' does not satisfy requirement '${constraint.raw}'.`,
              metadata: {
                detectedVersion: parsed.version,
                requirement: constraint.raw,
              },
            }),
          ],
        });
      }

      return createPythonRuntimeDetectionResult({
        state: PythonRuntimeDetectionStates.available,
        requirement: constraint?.raw,
        command,
        executablePath: parsed.executable,
        version: parsed.version,
        diagnostics,
        issues: [],
      });
    }

    return createPythonRuntimeDetectionResult({
      state: PythonRuntimeDetectionStates.missing,
      requirement: constraint?.raw,
      diagnostics,
      issues: [
        createPythonRuntimeProvisioningIssue({
          code: "python-runtime-not-found",
          severity: "error",
          message: "No usable Python interpreter was found for ComfyUI runtime provisioning.",
          metadata: {
            candidates: candidates.join(","),
            requirement: constraint?.raw,
          },
        }),
      ],
    });
  }

  private parseVersionConstraint(requirement?: string): ParsedVersionConstraint | undefined {
    if (!requirement) {
      return undefined;
    }
    const normalized = requirement.trim();
    const match = normalized.match(/^python\s*>=\s*(\d+)\.(\d+)$/i);
    if (!match) {
      return undefined;
    }
    return Object.freeze({
      raw: normalized,
      minimumMajor: Number.parseInt(match[1] ?? "0", 10),
      minimumMinor: Number.parseInt(match[2] ?? "0", 10),
    });
  }

  private satisfiesMinimumVersion(version: string, constraint: ParsedVersionConstraint): boolean {
    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match) {
      return false;
    }
    const major = Number.parseInt(match[1] ?? "0", 10);
    const minor = Number.parseInt(match[2] ?? "0", 10);
    if (major > constraint.minimumMajor) {
      return true;
    }
    if (major < constraint.minimumMajor) {
      return false;
    }
    return minor >= constraint.minimumMinor;
  }

  private isReusableEnvironment(environment: ResolvedPythonEnvironment): boolean {
    if (!existsSync(environment.environmentDirectory)) {
      return false;
    }
    if (!existsSync(environment.pythonExecutable)) {
      return false;
    }
    return true;
  }

  private cleanupStaleStagingDirectories(environmentDirectory: string): void {
    const parent = path.dirname(environmentDirectory);
    const baseName = path.basename(environmentDirectory);
    if (!existsSync(parent)) {
      return;
    }
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

  private async ensurePipIntegrity(
    pythonExecutable: string,
    cwd: string,
    diagnostics: PythonRuntimeCommandDiagnostic[],
  ): Promise<{ readonly ok: boolean; readonly repaired: boolean }> {
    const importCheck = await this.commandRunner.run(pythonExecutable, ["-c", "import pip; import pip._internal.cli.main"], { cwd });
    diagnostics.push(createPythonRuntimeCommandDiagnostic(importCheck));
    if (importCheck.exitCode === 0) {
      const pipVersion = await this.commandRunner.run(pythonExecutable, ["-m", "pip", "--version"], { cwd });
      diagnostics.push(createPythonRuntimeCommandDiagnostic(pipVersion));
      return Object.freeze({ ok: pipVersion.exitCode === 0, repaired: false });
    }

    const ensurePip = await this.commandRunner.run(pythonExecutable, ["-m", "ensurepip", "--upgrade"], { cwd });
    diagnostics.push(createPythonRuntimeCommandDiagnostic(ensurePip));
    if (ensurePip.exitCode !== 0) {
      return Object.freeze({ ok: false, repaired: false });
    }

    const importAfterRepair = await this.commandRunner.run(pythonExecutable, ["-c", "import pip; import pip._internal.cli.main"], { cwd });
    diagnostics.push(createPythonRuntimeCommandDiagnostic(importAfterRepair));
    if (importAfterRepair.exitCode !== 0) {
      return Object.freeze({ ok: false, repaired: true });
    }

    const pipVersion = await this.commandRunner.run(pythonExecutable, ["-m", "pip", "--version"], { cwd });
    diagnostics.push(createPythonRuntimeCommandDiagnostic(pipVersion));
    return Object.freeze({ ok: pipVersion.exitCode === 0, repaired: true });
  }

  private persistEnvironmentState(context: ComfyRuntimeOrchestrationContext, state: PersistedEnvironmentState): void {
    const environment = this.resolveEnvironment(context);
    mkdirSync(path.dirname(environment.metadataPath), { recursive: true });
    writeFileSync(environment.metadataPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private readDependencyInstallState(dependencyStatePath: string): PythonDependencyInstallState | undefined {
    if (!existsSync(dependencyStatePath)) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(readFileSync(dependencyStatePath, "utf8")) as PythonDependencyInstallState;
      return createPythonDependencyInstallState(parsed);
    } catch {
      return undefined;
    }
  }

  private persistDependencyState(input: {
    readonly dependencyStatePath: string;
    readonly state: PythonDependencyInstallState;
  }): PythonDependencyInstallState {
    const state = createPythonDependencyInstallState(input.state);
    writeFileSync(input.dependencyStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  }

  private normalizeCommandFailure(command: PythonCommandRecord): string {
    const detail = command.stderr.trim() || command.stdout.trim() || "unknown error";
    return `${command.command} ${command.args.join(" ")} exited with ${command.exitCode}: ${detail}`;
  }
}

class NodePythonCommandRunner implements PythonCommandRunner {
  public async run(command: string, args: ReadonlyArray<string>, options: { readonly cwd?: string } = {}): Promise<PythonCommandRecord> {
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

function parsePythonProbe(stdout: string): { readonly version: string; readonly executable: string } | undefined {
  try {
    const parsed = JSON.parse(stdout) as { readonly version?: unknown; readonly executable?: unknown };
    if (typeof parsed.version !== "string" || typeof parsed.executable !== "string") {
      return undefined;
    }
    const version = parsed.version.trim();
    const executable = parsed.executable.trim();
    if (!version || !executable) {
      return undefined;
    }
    return Object.freeze({ version, executable });
  } catch {
    return undefined;
  }
}

function bufferToString(value: string | Buffer | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

