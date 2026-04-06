import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HostBootModes,
  createHostBootConfiguration,
  type HostBootConfiguration,
  type HostBootMode,
} from "../../application/common/HostCompositionContracts";
import { WebHostRuntime } from "../HostRuntimeCatalog";
import {
  createWebCompositionRoot,
  type WebCompositionRootOptions,
  type WebHostRuntimeHandle,
  type WebRuntimeHost,
} from "./WebHostCompositionRoot";

export const WebHostEnvironmentKeys = Object.freeze({
  deliveryMode: "AI_LOOM_WEB_DELIVERY_MODE",
  basePath: "AI_LOOM_WEB_BASE_PATH",
});

export interface WebHostEntrypointBootOptions {
  readonly mode?: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}

export interface WebHostEntrypointOptions {
  readonly hostOptions?: WebCompositionRootOptions["hostOptions"];
  readonly startHost?: WebCompositionRootOptions["startHost"];
  readonly bootstrap?: WebCompositionRootOptions["bootstrap"];
  readonly boot?: WebHostEntrypointBootOptions;
}

export interface ConstructedWebHostAssembly {
  readonly compositionRoot: ReturnType<typeof createWebCompositionRoot>;
  readonly boot: HostBootConfiguration;
}

const DefaultStartupReason = "web-host-entrypoint-startup";

function resolveDefaultRequiredDependencyIds(): ReadonlyArray<string> {
  return Object.freeze(WebHostRuntime.startupDependencies.map((dependency) => dependency.dependencyId));
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

async function startDefaultWebRuntimeHost(
  _options: Readonly<Record<string, unknown>>,
  _boot: HostBootConfiguration,
): Promise<WebRuntimeHost> {
  return Object.freeze({
    close: async () => undefined,
  });
}

export function createWebHostBootConfiguration(
  options?: WebHostEntrypointBootOptions,
): HostBootConfiguration {
  return createHostBootConfiguration({
    host: WebHostRuntime,
    mode: options?.mode ?? HostBootModes.coldStart,
    startedAt: options?.startedAt,
    startupReason: options?.startupReason ?? DefaultStartupReason,
    environment: options?.environment ?? process.env,
    requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds(),
  });
}

export function constructWebHostAssembly(
  options: WebHostEntrypointOptions = {},
): ConstructedWebHostAssembly {
  const compositionRoot = createWebCompositionRoot({
    hostOptions: options.hostOptions,
    startHost: options.startHost ?? startDefaultWebRuntimeHost,
    bootstrap: options.bootstrap,
  });
  const boot = createWebHostBootConfiguration(options.boot);

  return Object.freeze({
    compositionRoot,
    boot,
  });
}

export async function startWebHostAssembly(
  options: WebHostEntrypointOptions = {},
): Promise<WebHostRuntimeHandle> {
  const assembly = constructWebHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}

export function resolveWebHostEntrypointOptionsFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WebHostEntrypointOptions {
  const deliveryMode = normalizeOptional(env[WebHostEnvironmentKeys.deliveryMode]);
  const basePath = normalizeOptional(env[WebHostEnvironmentKeys.basePath]);

  return Object.freeze({
    hostOptions: Object.freeze({
      deliveryMode: deliveryMode === "static-shell" ? "static-shell" : "thin-client",
      basePath,
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

async function runWebHostFromCli(): Promise<void> {
  const runtime = await startWebHostAssembly(
    resolveWebHostEntrypointOptionsFromEnvironment(process.env),
  );
  process.stdout.write(
    `[ai-loom] web host assembly started for '${runtime.host.hostId}' (phase=${runtime.phase})\n`,
  );

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stdout.write(`[ai-loom] web host assembly stopping (${signal})\n`);
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
  runWebHostFromCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ai-loom] web host assembly failed: ${message}\n`);
    process.exit(1);
  });
}
