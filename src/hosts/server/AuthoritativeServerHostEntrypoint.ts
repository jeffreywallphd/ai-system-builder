import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HostBootModes,
  createHostBootConfiguration,
  type HostBootConfiguration,
  type HostBootMode,
} from "@application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../HostRuntimeCatalog";
import {
  createAuthoritativeServerCompositionRoot,
  type AuthoritativeServerCompositionRootOptions,
  type AuthoritativeServerHostRuntimeHandle,
} from "./AuthoritativeServerCompositionRoot";
import type { IdentityServerHost, IdentityServerHostOptions } from "./IdentityServerHost";

export const AuthoritativeServerHostEnvironmentKeys = Object.freeze({
  databasePath: "AI_LOOM_SERVER_DATABASE_PATH",
  host: "AI_LOOM_SERVER_HOST",
  port: "AI_LOOM_SERVER_PORT",
});

export interface AuthoritativeServerHostEntrypointBootOptions {
  readonly mode?: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}

export interface AuthoritativeServerHostEntrypointOptions {
  readonly hostOptions: IdentityServerHostOptions;
  readonly startHost?: (options: IdentityServerHostOptions) => Promise<IdentityServerHost>;
  readonly bootstrap?: AuthoritativeServerCompositionRootOptions["bootstrap"];
  readonly boot?: AuthoritativeServerHostEntrypointBootOptions;
}

export interface ConstructedAuthoritativeServerHostAssembly {
  readonly compositionRoot: ReturnType<typeof createAuthoritativeServerCompositionRoot>;
  readonly boot: HostBootConfiguration;
}

const DefaultStartupReason = "authoritative-server-entrypoint-startup";
const DefaultDatabaseRelativePath = path.resolve("runtime-assets", "server", "authoritative-server.sqlite");

function resolveDefaultRequiredDependencyIds(): ReadonlyArray<string> {
  return Object.freeze(AuthoritativeServerHostRuntime.startupDependencies.map((dependency) => dependency.dependencyId));
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolvePort(value: string | undefined): number | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Environment variable '${AuthoritativeServerHostEnvironmentKeys.port}' must be a valid TCP port.`);
  }
  return parsed;
}

export function createAuthoritativeServerHostBootConfiguration(
  options?: AuthoritativeServerHostEntrypointBootOptions,
): HostBootConfiguration {
  return createHostBootConfiguration({
    host: AuthoritativeServerHostRuntime,
    mode: options?.mode ?? HostBootModes.coldStart,
    startedAt: options?.startedAt,
    startupReason: options?.startupReason ?? DefaultStartupReason,
    environment: options?.environment ?? process.env,
    requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds(),
  });
}

export function constructAuthoritativeServerHostAssembly(
  options: AuthoritativeServerHostEntrypointOptions,
): ConstructedAuthoritativeServerHostAssembly {
  const compositionRoot = createAuthoritativeServerCompositionRoot({
    hostOptions: options.hostOptions,
    startHost: options.startHost,
    bootstrap: options.bootstrap,
  });
  const boot = createAuthoritativeServerHostBootConfiguration(options.boot);

  return Object.freeze({
    compositionRoot,
    boot,
  });
}

export async function startAuthoritativeServerHostAssembly(
  options: AuthoritativeServerHostEntrypointOptions,
): Promise<AuthoritativeServerHostRuntimeHandle> {
  const assembly = constructAuthoritativeServerHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}

export function resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthoritativeServerHostEntrypointOptions {
  const databasePath = normalizeOptional(env[AuthoritativeServerHostEnvironmentKeys.databasePath]) ?? DefaultDatabaseRelativePath;
  const host = normalizeOptional(env[AuthoritativeServerHostEnvironmentKeys.host]);
  const port = resolvePort(env[AuthoritativeServerHostEnvironmentKeys.port]);

  return Object.freeze({
    hostOptions: Object.freeze({
      databasePath,
      host,
      port,
      env,
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

async function runAuthoritativeServerHostFromCli(): Promise<void> {
  const runtime = await startAuthoritativeServerHostAssembly(
    resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment(process.env),
  );
  process.stdout.write(
    `[ai-loom] authoritative server host started at ${runtime.address} (phase=${runtime.phase})\n`,
  );

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stdout.write(`[ai-loom] authoritative server host stopping (${signal})\n`);
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
  runAuthoritativeServerHostFromCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ai-loom] authoritative server host failed: ${message}\n`);
    process.exit(1);
  });
}

