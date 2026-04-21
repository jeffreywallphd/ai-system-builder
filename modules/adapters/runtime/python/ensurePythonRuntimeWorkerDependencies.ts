import { spawnSync, type SpawnSyncReturns, type SpawnSyncOptions } from "node:child_process";

export interface EnsurePythonRuntimeWorkerDependenciesOptions {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  requirementsFile?: string;
  spawnSyncImplementation?: typeof spawnSync;
}

function normalizeOutput(result: SpawnSyncReturns<string>): string {
  const output = [result.stdout, result.stderr]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
  return output.length > 0 ? output : "No output captured.";
}

function runCommand(
  spawnSyncImplementation: typeof spawnSync,
  command: string,
  args: readonly string[],
  options: Pick<EnsurePythonRuntimeWorkerDependenciesOptions, "cwd" | "env">,
): SpawnSyncReturns<string> {
  return spawnSyncImplementation(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  } satisfies SpawnSyncOptions);
}

export function ensurePythonRuntimeWorkerDependencies(
  options: EnsurePythonRuntimeWorkerDependenciesOptions,
): void {
  const requirementsFile = options.requirementsFile ?? "requirements.txt";
  const spawnSyncImplementation = options.spawnSyncImplementation ?? spawnSync;

  const probeResult = runCommand(
    spawnSyncImplementation,
    options.command,
    ["-c", "import fastapi, uvicorn, huggingface_hub"],
    options,
  );

  if (probeResult.status === 0) {
    return;
  }

  const probeOutput = normalizeOutput(probeResult);
  if (probeResult.error) {
    throw new Error(`Failed to probe Python runtime worker dependencies: ${probeOutput}`);
  }

  const missingDependencyPattern = /No module named ['"](fastapi|uvicorn|huggingface_hub)['"]/i;
  if (!missingDependencyPattern.test(probeOutput)) {
    throw new Error(
      `Python dependency probe failed for an unexpected reason; aborting startup. ${probeOutput}`,
    );
  }

  const installResult = runCommand(
    spawnSyncImplementation,
    options.command,
    ["-m", "pip", "install", "-r", requirementsFile],
    options,
  );

  if (installResult.status === 0) {
    return;
  }

  const installOutput = normalizeOutput(installResult);
  throw new Error(`Failed to install Python runtime worker dependencies. ${installOutput}`);
}
