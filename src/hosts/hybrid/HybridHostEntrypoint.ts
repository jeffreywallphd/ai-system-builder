import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HostBootModes,
  createHostBootConfiguration,
  type HostBootConfiguration,
  type HostBootMode,
} from "../../application/common/HostCompositionContracts";
import { HybridHostRuntime } from "../HostRuntimeCatalog";
import {
  HybridHostControlPlaneSources,
  createHybridCompositionRoot,
  type HybridCapabilitySelection,
  type HybridCompositionRootOptions,
  type HybridHostControlPlaneSource,
  type HybridHostRuntimeHandle,
  type HybridRuntimeStartContext,
  type HybridRuntimeHost,
} from "./HybridHostCompositionRoot";
import {
  resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment,
  startAuthoritativeServerHostAssembly,
  type AuthoritativeServerHostEntrypointOptions,
  type AuthoritativeServerHostRuntimeHandle,
} from "../server/AuthoritativeServerHostEntrypoint";

export const HybridHostEnvironmentKeys = Object.freeze({
  mode: "AI_LOOM_HYBRID_HOST_MODE",
  controlPlaneSource: "AI_LOOM_HYBRID_CONTROL_PLANE_SOURCE",
  enableNodeExecution: "AI_LOOM_HYBRID_ENABLE_NODE_EXECUTION",
  enableWorkerRuntime: "AI_LOOM_HYBRID_ENABLE_WORKER_RUNTIME",
});

export const HybridHostAssemblyModes = Object.freeze({
  hybridClient: "hybrid-client",
  authoritativeServerHost: "authoritative-server-host",
});

export type HybridHostAssemblyMode = typeof HybridHostAssemblyModes[keyof typeof HybridHostAssemblyModes];

export interface HybridHostEntrypointBootOptions {
  readonly mode?: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}

export interface HybridHostEntrypointOptions {
  readonly assemblyMode?: HybridHostAssemblyMode;
  readonly hostOptions?: HybridCompositionRootOptions["hostOptions"];
  readonly startHost?: HybridCompositionRootOptions["startHost"];
  readonly capabilitySelection?: HybridCapabilitySelection;
  readonly controlPlaneSource?: HybridHostControlPlaneSource;
  readonly bootstrap?: HybridCompositionRootOptions["bootstrap"];
  readonly authoritativeServerOptions?: AuthoritativeServerHostEntrypointOptions;
  readonly boot?: HybridHostEntrypointBootOptions;
}

export type HybridHostAssemblyRuntimeHandle = HybridHostRuntimeHandle | AuthoritativeServerHostRuntimeHandle;

export interface ConstructedHybridHostAssembly {
  readonly assemblyMode: HybridHostAssemblyMode;
  readonly compositionRoot?: ReturnType<typeof createHybridCompositionRoot>;
  readonly boot?: HostBootConfiguration;
  readonly authoritativeServerOptions?: AuthoritativeServerHostEntrypointOptions;
}

const DefaultStartupReason = "hybrid-host-entrypoint-startup";

function resolveDefaultRequiredDependencyIds(): ReadonlyArray<string> {
  return Object.freeze(HybridHostRuntime.startupDependencies.map((dependency) => dependency.dependencyId));
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

function resolveAssemblyMode(value: string | undefined): HybridHostAssemblyMode {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return HybridHostAssemblyModes.hybridClient;
  }
  if (normalized === HybridHostAssemblyModes.hybridClient || normalized === HybridHostAssemblyModes.authoritativeServerHost) {
    return normalized;
  }
  throw new Error(
    `Environment variable '${HybridHostEnvironmentKeys.mode}' must be '${HybridHostAssemblyModes.hybridClient}' ` +
    `or '${HybridHostAssemblyModes.authoritativeServerHost}'.`,
  );
}

function resolveControlPlaneSource(value: string | undefined): HybridHostControlPlaneSource {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return HybridHostControlPlaneSources.remoteAuthoritativeServer;
  }
  if (
    normalized === HybridHostControlPlaneSources.remoteAuthoritativeServer
    || normalized === HybridHostControlPlaneSources.localAuthoritativeServerDelegated
  ) {
    return normalized;
  }
  throw new Error(
    `Environment variable '${HybridHostEnvironmentKeys.controlPlaneSource}' must be ` +
    `'${HybridHostControlPlaneSources.remoteAuthoritativeServer}' or ` +
    `'${HybridHostControlPlaneSources.localAuthoritativeServerDelegated}'.`,
  );
}

async function startDefaultHybridRuntimeHost(
  _options: Readonly<Record<string, unknown>>,
  _boot: HostBootConfiguration,
  _context: HybridRuntimeStartContext,
): Promise<HybridRuntimeHost> {
  return Object.freeze({
    close: async () => undefined,
  });
}

export function createHybridHostBootConfiguration(
  options?: HybridHostEntrypointBootOptions,
): HostBootConfiguration {
  return createHostBootConfiguration({
    host: HybridHostRuntime,
    mode: options?.mode ?? HostBootModes.coldStart,
    startedAt: options?.startedAt,
    startupReason: options?.startupReason ?? DefaultStartupReason,
    environment: options?.environment ?? process.env,
    requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds(),
  });
}

export function constructHybridHostAssembly(
  options: HybridHostEntrypointOptions,
): ConstructedHybridHostAssembly {
  const assemblyMode = options.assemblyMode ?? HybridHostAssemblyModes.hybridClient;

  if (assemblyMode === HybridHostAssemblyModes.authoritativeServerHost) {
    return Object.freeze({
      assemblyMode,
      authoritativeServerOptions: options.authoritativeServerOptions
        ?? resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment(options.boot?.environment ?? process.env),
    });
  }

  const compositionRoot = createHybridCompositionRoot({
    hostOptions: options.hostOptions,
    startHost: options.startHost ?? startDefaultHybridRuntimeHost,
    capabilitySelection: options.capabilitySelection,
    controlPlaneSource: options.controlPlaneSource,
    bootstrap: options.bootstrap,
  });
  const boot = createHybridHostBootConfiguration(options.boot);

  return Object.freeze({
    assemblyMode,
    compositionRoot,
    boot,
  });
}

export async function startHybridHostAssembly(
  options: HybridHostEntrypointOptions = {},
): Promise<HybridHostAssemblyRuntimeHandle> {
  const assembly = constructHybridHostAssembly(options);
  if (assembly.assemblyMode === HybridHostAssemblyModes.authoritativeServerHost) {
    const authoritativeOptions = assembly.authoritativeServerOptions
      ?? resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment(options.boot?.environment ?? process.env);
    return startAuthoritativeServerHostAssembly(authoritativeOptions);
  }
  if (!assembly.compositionRoot || !assembly.boot) {
    throw new Error("Hybrid host assembly construction failed to produce composition root and boot configuration.");
  }
  return assembly.compositionRoot.compose(assembly.boot);
}

export function resolveHybridHostEntrypointOptionsFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): HybridHostEntrypointOptions {
  const assemblyMode = resolveAssemblyMode(env[HybridHostEnvironmentKeys.mode]);
  if (assemblyMode === HybridHostAssemblyModes.authoritativeServerHost) {
    return Object.freeze({
      assemblyMode,
      authoritativeServerOptions: resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment(env),
      boot: Object.freeze({
        environment: env,
      }),
    });
  }

  return Object.freeze({
    assemblyMode,
    controlPlaneSource: resolveControlPlaneSource(env[HybridHostEnvironmentKeys.controlPlaneSource]),
    capabilitySelection: Object.freeze({
      enableNodeExecution: parseBoolean(env[HybridHostEnvironmentKeys.enableNodeExecution]),
      enableWorkerRuntime: parseBoolean(env[HybridHostEnvironmentKeys.enableWorkerRuntime]),
    }),
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

async function runHybridHostFromCli(): Promise<void> {
  const runtime = await startHybridHostAssembly(
    resolveHybridHostEntrypointOptionsFromEnvironment(process.env),
  );
  process.stdout.write(
    `[ai-loom] hybrid host assembly started for '${runtime.host.hostId}' (phase=${runtime.phase})\n`,
  );

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stdout.write(`[ai-loom] hybrid host assembly stopping (${signal})\n`);
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
  runHybridHostFromCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ai-loom] hybrid host assembly failed: ${message}\n`);
    process.exit(1);
  });
}
