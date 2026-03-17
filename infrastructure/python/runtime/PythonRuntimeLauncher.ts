import { resolve } from "node:path";

export interface RuntimeProcessLike {
  readonly pid?: number;
  readonly stdout?: { on(event: "data", listener: (chunk: unknown) => void): void };
  readonly stderr?: { on(event: "data", listener: (chunk: unknown) => void): void };
  readonly on: (event: "error" | "exit", listener: (...args: any[]) => void) => void;
  readonly kill: (signal?: string) => boolean;
}

export interface RuntimeSpawnOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly stdio?: string | ReadonlyArray<string>;
}

export type RuntimeSpawn = (
  command: string,
  args: ReadonlyArray<string>,
  options: RuntimeSpawnOptions
) => RuntimeProcessLike;

export interface PythonRuntimeLauncherOptions {
  readonly pythonExecutable?: string;
  readonly runtimeWorkingDirectory?: string;
  readonly entryModule?: string;
  readonly host?: string;
  readonly port?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly spawn: RuntimeSpawn;
}

export class PythonRuntimeLauncher {
  private readonly options: Required<Omit<PythonRuntimeLauncherOptions, "spawn" | "env">> & {
    readonly env?: Readonly<Record<string, string | undefined>>;
  };

  private readonly spawn: RuntimeSpawn;

  constructor(options: PythonRuntimeLauncherOptions) {
    this.spawn = options.spawn;
    this.options = {
      pythonExecutable: options.pythonExecutable?.trim() || "python",
      runtimeWorkingDirectory:
        options.runtimeWorkingDirectory?.trim() || resolve(process.cwd(), "python-runtime"),
      entryModule: options.entryModule?.trim() || "app.main:app",
      host: options.host?.trim() || "127.0.0.1",
      port: options.port && options.port > 0 ? options.port : 8000,
      env: options.env,
    };
  }

  public launch(): RuntimeProcessLike {
    const args = [
      "-m",
      "uvicorn",
      this.options.entryModule,
      "--host",
      this.options.host,
      "--port",
      String(this.options.port),
    ];

    return this.spawn(this.options.pythonExecutable, args, {
      cwd: this.options.runtimeWorkingDirectory,
      env: this.options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}
