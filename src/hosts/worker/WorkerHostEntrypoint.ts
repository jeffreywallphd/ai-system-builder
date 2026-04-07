import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HostCapabilityFlags, type HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import {
  HostBootModes,
  createHostBootConfiguration,
  type HostBootConfiguration,
  type HostBootMode,
} from "@application/common/HostCompositionContracts";
import { WorkerHostRuntime } from "../HostRuntimeCatalog";
import {
  createWorkerCompositionRoot,
  type WorkerCapabilitySelection,
  type WorkerCompositionRootOptions,
  type WorkerHostRuntimeHandle,
  type WorkerRuntimeHost,
} from "./WorkerHostCompositionRoot";

export const WorkerHostEnvironmentKeys = Object.freeze({
  enableNodeExecution: "AI_LOOM_WORKER_ENABLE_NODE_EXECUTION",
  enableWorkerRuntime: "AI_LOOM_WORKER_ENABLE_WORKER_RUNTIME",
  nodeRegistrationCapabilities: "AI_LOOM_WORKER_NODE_REGISTRATION_CAPABILITIES",
});

export interface WorkerHostEntrypointBootOptions {
  readonly mode?: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}

export interface WorkerHostEntrypointOptions {
  readonly hostOptions?: WorkerCompositionRootOptions["hostOptions"];
  readonly startHost?: WorkerCompositionRootOptions["startHost"];
  readonly capabilitySelection?: WorkerCapabilitySelection;
  readonly nodeRegistrationCapabilities?: WorkerCompositionRootOptions["nodeRegistrationCapabilities"];
  readonly bootstrap?: WorkerCompositionRootOptions["bootstrap"];
  readonly boot?: WorkerHostEntrypointBootOptions;
}

export interface ConstructedWorkerHostAssembly {
  readonly compositionRoot: ReturnType<typeof createWorkerCompositionRoot>;
  readonly boot: HostBootConfiguration;
}

const DefaultStartupReason = "worker-host-entrypoint-startup";

function resolveDefaultRequiredDependencyIds(): ReadonlyArray<string> {
  return Object.freeze(WorkerHostRuntime.startupDependencies.map((dependency) => dependency.dependencyId));
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new Error(`Boolean environment value '${value}' is invalid.`);
}

function parseNodeRegistrationCapabilities(value: string | undefined): ReadonlyArray<HostCapabilityFlag> {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return Object.freeze([]);
  }

  const values = new Set<HostCapabilityFlag>();
  for (const raw of normalized.split(",")) {
    const requested = raw.trim() as HostCapabilityFlag;
    if (!requested) {
      continue;
    }
    if (!Object.values(HostCapabilityFlags).includes(requested)) {
      throw new Error(
        `Environment variable '${WorkerHostEnvironmentKeys.nodeRegistrationCapabilities}' includes unsupported ` +
        `capability '${requested}'.`,
      );
    }
    values.add(requested);
  }

  return Object.freeze([...values.values()]);
}

async function startDefaultWorkerRuntimeHost(
  _options: Readonly<Record<string, unknown>>,
  _boot: HostBootConfiguration,
): Promise<WorkerRuntimeHost> {
  return Object.freeze({
    close: async () => undefined,
  });
}

export function createWorkerHostBootConfiguration(
  options?: WorkerHostEntrypointBootOptions,
): HostBootConfiguration {
  return createHostBootConfiguration({
    host: WorkerHostRuntime,
    mode: options?.mode ?? HostBootModes.coldStart,
    startedAt: options?.startedAt,
    startupReason: options?.startupReason ?? DefaultStartupReason,
    environment: options?.environment ?? process.env,
    requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds(),
  });
}

export function constructWorkerHostAssembly(
  options: WorkerHostEntrypointOptions = {},
): ConstructedWorkerHostAssembly {
  const compositionRoot = createWorkerCompositionRoot({
    hostOptions: options.hostOptions,
    startHost: options.startHost ?? startDefaultWorkerRuntimeHost,
    capabilitySelection: options.capabilitySelection,
    nodeRegistrationCapabilities: options.nodeRegistrationCapabilities,
    bootstrap: options.bootstrap,
  });
  const boot = createWorkerHostBootConfiguration(options.boot);

  return Object.freeze({
    compositionRoot,
    boot,
  });
}

export async function startWorkerHostAssembly(
  options: WorkerHostEntrypointOptions = {},
): Promise<WorkerHostRuntimeHandle> {
  const assembly = constructWorkerHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}

export function resolveWorkerHostEntrypointOptionsFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WorkerHostEntrypointOptions {
  return Object.freeze({
    capabilitySelection: Object.freeze({
      enableNodeExecution: parseBoolean(env[WorkerHostEnvironmentKeys.enableNodeExecution]),
      enableWorkerRuntime: parseBoolean(env[WorkerHostEnvironmentKeys.enableWorkerRuntime]),
    }),
    nodeRegistrationCapabilities: parseNodeRegistrationCapabilities(
      env[WorkerHostEnvironmentKeys.nodeRegistrationCapabilities],
    ),
    boot: Object.freeze({
      environment: env,
    }),
  });
}

function isMainModule(metaUrl: string): boolean {
  const mainScriptPath = process.argv[1];
  if (!mainScriptPath) {
    return false;
  }
  return pathToFileURL(path.resolve(mainScriptPath)).href === metaUrl;
}

async function runWorkerHostFromCli(): Promise<void> {
  const runtime = await startWorkerHostAssembly(
    resolveWorkerHostEntrypointOptionsFromEnvironment(process.env),
  );
  process.stdout.write(
    `[ai-loom] worker host assembly started for '${runtime.host.hostId}' (phase=${runtime.phase})\n`,
  );

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stdout.write(`[ai-loom] worker host assembly stopping (${signal})\n`);
    await runtime.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void stop("SIGINT");
  });
  process.on("SIGTERM", () => {
    void stop("SIGTERM");
  });
}

const thisModulePath = fileURLToPath(import.meta.url);
if (isMainModule(pathToFileURL(thisModulePath).href)) {
  runWorkerHostFromCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ai-loom] worker host assembly failed: ${message}\n`);
    process.exit(1);
  });
}

