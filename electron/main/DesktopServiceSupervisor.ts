import path from "node:path";
import process from "node:process";
import { spawn, type ChildProcess } from "node:child_process";
import type { DesktopPythonRuntimeInfo, DesktopStoragePaths } from "../shared/DesktopContracts";

export interface DesktopServiceSupervisorOptions {
  readonly repoRoot: string;
  readonly isPackaged: boolean;
  readonly resourcesPath: string;
  readonly storagePaths: DesktopStoragePaths;
  readonly pythonRuntime: DesktopPythonRuntimeInfo;
  readonly port?: number;
  readonly host?: string;
  readonly pythonRuntimeBaseUrl?: string;
}

export class DesktopServiceSupervisor {
  private processHandle?: ChildProcess;
  private readonly port: number;
  private readonly host: string;
  private readonly pythonRuntimeBaseUrl: string;

  constructor(private readonly options: DesktopServiceSupervisorOptions) {
    this.port = options.port ?? 8790;
    this.host = options.host ?? "127.0.0.1";
    this.pythonRuntimeBaseUrl = options.pythonRuntimeBaseUrl ?? "http://127.0.0.1:8100";
  }

  public get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  public get runtimeBaseUrl(): string {
    return this.pythonRuntimeBaseUrl;
  }

  public async start(): Promise<void> {
    if (this.processHandle && !this.processHandle.killed) {
      return;
    }

    const entrypoint = this.options.isPackaged
      ? path.join(this.options.resourcesPath, "service-supervisor.js")
      : path.join(this.options.repoRoot, "src", "infrastructure", "runtime", "service-supervisor.js");

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: this.options.isPackaged ? "production" : "development",
      SERVICE_SUPERVISOR_HOST: this.host,
      SERVICE_SUPERVISOR_PORT: String(this.port),
      SERVICE_SUPERVISOR_DEFINITIONS_PATH: path.join(this.options.storagePaths.appDataDirectory, "managed-services.json"),
      SERVICE_SUPERVISOR_ALLOWED_PATHS: JSON.stringify([
        this.options.storagePaths.appDataDirectory,
        this.options.storagePaths.runtimeDirectory,
        this.options.storagePaths.modelsDirectory,
        this.options.storagePaths.assetsDirectory,
        this.options.repoRoot,
      ]),
      PYTHON_RUNTIME_MODE: "managed-local",
      PYTHON_RUNTIME_BASE_URL: this.pythonRuntimeBaseUrl,
      PYTHON_RUNTIME_WORKDIR: this.options.pythonRuntime.workspaceDirectory,
      PYTHON_RUNTIME_INTERPRETER_PATH: this.options.pythonRuntime.executablePath ?? "",
      PYTHON_RUNTIME_EXECUTABLE: this.options.pythonRuntime.executablePath ?? process.env.PYTHON_RUNTIME_EXECUTABLE ?? "python",
      PYTHON_RUNTIME_BIND_HOST: "127.0.0.1",
    };

    this.processHandle = spawn(process.execPath, [entrypoint], {
      cwd: this.options.isPackaged ? this.options.resourcesPath : this.options.repoRoot,
      env,
      stdio: "inherit",
    });

    this.processHandle.once("exit", () => {
      this.processHandle = undefined;
    });
  }

  public async stop(): Promise<void> {
    if (!this.processHandle || this.processHandle.killed) {
      return;
    }

    const handle = this.processHandle;
    await new Promise<void>((resolve) => {
      handle.once("exit", () => resolve());
      handle.kill("SIGTERM");
      setTimeout(() => {
        if (!handle.killed) {
          handle.kill("SIGKILL");
        }
      }, 5_000).unref();
    });

    this.processHandle = undefined;
  }
}
