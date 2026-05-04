import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import express from "express";

import { composeServerHost } from "../../../modules/hosts/server";
import { applySecurityHeaders, registerSecurityRoutes } from "../../../modules/adapters/transport/api-express/security";
import { composeServerSecurity } from "../../../modules/hosts/server/security/composeServerSecurity";
import type { LoggingPort } from "../../../modules/application/ports/logging";
import type { StructuredLogSink } from "../../../modules/adapters/observability/logging";

export const DEFAULT_SERVER_PORT = 3010;
export const DEFAULT_SERVER_STORAGE_ROOT_DIRECTORY_NAME = "server-artifacts";
export const DEFAULT_SERVER_LOCAL_STATE_DIRECTORY_NAME = ".local";
export const DEFAULT_SERVER_RUNTIME_ROOT_DIRECTORY_NAME = "server-runtime";

export interface ServerRuntimeConfig {
  port: number;
  storageRootDirectory: string;
  runtimeRootDirectory: string;
  security: Awaited<ReturnType<typeof composeServerSecurity>>["config"];
}

export interface CreateServerOptions {
  env?: NodeJS.ProcessEnv;
  logSink?: StructuredLogSink;
  now?: () => string;
}

export interface CreatedServer {
  app: express.Express;
  config: ServerRuntimeConfig;
  loggingPort: LoggingPort;
}

interface ServerRootResolutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function normalizePort(rawPort: string | undefined): number {
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return DEFAULT_SERVER_PORT;
  }

  return parsedPort;
}

function isServerAppRootDirectory(directory: string): boolean {
  const packageJsonPath = path.join(directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
    return packageJson.name === "@ai-system-builder/server";
  } catch {
    return false;
  }
}

function findServerAppRootFromSeed(seedDirectory: string): string | undefined {
  let cursor = path.resolve(seedDirectory);
  while (true) {
    if (isServerAppRootDirectory(cursor)) {
      return cursor;
    }

    const workspaceServerDirectory = path.join(cursor, "apps", "server");
    if (isServerAppRootDirectory(workspaceServerDirectory)) {
      return workspaceServerDirectory;
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return undefined;
    }
    cursor = parent;
  }
}

export function resolveServerAppRootDirectory(options: ServerRootResolutionOptions = {}): string {
  const env = options.env ?? process.env;
  const seedDirectories = [
    options.cwd,
    env.INIT_CWD,
    process.cwd(),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const seedDirectory of seedDirectories) {
    const serverAppRoot = findServerAppRootFromSeed(seedDirectory);
    if (serverAppRoot) {
      return serverAppRoot;
    }
  }

  return path.resolve("apps", "server");
}

export function resolveDefaultServerStorageRootDirectory(options: ServerRootResolutionOptions = {}): string {
  return path.join(resolveServerAppRootDirectory(options), DEFAULT_SERVER_STORAGE_ROOT_DIRECTORY_NAME);
}

export function resolveDefaultServerRuntimeRootDirectory(options: ServerRootResolutionOptions = {}): string {
  return path.join(
    resolveServerAppRootDirectory(options),
    DEFAULT_SERVER_LOCAL_STATE_DIRECTORY_NAME,
    DEFAULT_SERVER_RUNTIME_ROOT_DIRECTORY_NAME,
  );
}

export function resolveServerRuntimeRootDirectory(
  env: NodeJS.ProcessEnv = process.env,
  options: { cwd?: string } = {},
): string {
  const runtimeRootFromEnv = env.SERVER_RUNTIME_ROOT?.trim();
  return runtimeRootFromEnv && runtimeRootFromEnv.length > 0
    ? path.resolve(runtimeRootFromEnv)
    : resolveDefaultServerRuntimeRootDirectory({ cwd: options.cwd, env });
}

export async function resolveServerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { cwd?: string } = {},
): Promise<ServerRuntimeConfig> {
  const storageRootFromEnv = env.SERVER_STORAGE_ROOT?.trim();
  const rootResolutionOptions = { cwd: options.cwd, env };

  const storageRootDirectory =
    storageRootFromEnv && storageRootFromEnv.length > 0
      ? path.resolve(storageRootFromEnv)
      : resolveDefaultServerStorageRootDirectory(rootResolutionOptions);

  const runtimeRootDirectory = resolveServerRuntimeRootDirectory(env, options);
  const security = (await composeServerSecurity(env, storageRootDirectory)).config;
  return {
    port: normalizePort(env.PORT),
    storageRootDirectory,
    runtimeRootDirectory,
    security,
  };
}

export async function createServer(options: CreateServerOptions = {}): Promise<CreatedServer> {
  const config = await resolveServerRuntimeConfig(options.env);
  const security = await composeServerSecurity(options.env ?? process.env, config.storageRootDirectory);
  const serverHost = composeServerHost({
    env: options.env,
    logging: {
      verbosity: options.env?.LOG_VERBOSITY,
      level: "info",
    },
    logSink: options.logSink,
    now: options.now,
    artifactRepo: {
      huggingFaceAccessToken: options.env?.HF_TOKEN ?? options.env?.HUGGING_FACE_TOKEN,
      huggingFaceTokenConfigFilePath: path.join(config.storageRootDirectory, "config", "hugging-face-token.json"),
    },
  });

  const app = express();
  app.use(express.json({ limit: "5mb" }));
  applySecurityHeaders(app);
  app.use(security.middleware);
  registerSecurityRoutes(app, {
    getStatus: async (authContext) => ({ ...(await security.services.getStatusService.execute({ config: { mode: security.config.mode, httpsRequired: security.config.httpsRequired, authRequired: security.config.authRequired, allowLocalhostWithoutAuth: security.config.allowLocalhostWithoutAuth }, httpsEnabled: security.config.httpsEnabled, pairingEnabled: security.config.pairingEnabled, now: new Date(), currentAuthContext: authContext, devSecurityToggleEnabled: security.config.devSecurityToggleEnabled, devSecurityEnforcementMode: security.devSecurityEnforcement.isEnabled() ? security.devSecurityEnforcement.getMode() : undefined, requiresRestartToChangeTransportSecurity: true })), tls: security.config.tlsStatus }),
    completePairing: (body) => security.services.completePairing.execute(body),
    revokeToken: (body) => security.credentials.revokeDevice({ deviceId: body.deviceId, revokedAt: new Date() }),
    getDevMode: security.devSecurityEnforcement.isEnabled() ? () => security.devSecurityEnforcement.getMode() : undefined,
    setDevMode: security.devSecurityEnforcement.isEnabled() ? (mode) => security.devSecurityEnforcement.setMode(mode) : undefined,
    getLocalCaPem: security.config.tlsStatus?.mode === "auto-local-ca" && security.config.tlsStatus.localCa?.certificatePath ? async () => readFileSync(security.config.tlsStatus!.localCa!.certificatePath!, "utf8") : undefined,
  });

  serverHost.registerApi({
    app,
    storageRootDirectory: config.storageRootDirectory,
    runtimeRootDirectory: config.runtimeRootDirectory,
  });

  return {
    app,
    config,
    loggingPort: serverHost.loggingPort,
  };
}
