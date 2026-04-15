import path from "node:path";

import type express from "express";

import { composeServerHost } from "../../../modules/hosts/server";

const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_STORAGE_ROOT = path.resolve(process.cwd(), ".local", "server-artifacts");

export interface ServerRuntimeConfig {
  port: number;
  storageRootDirectory: string;
}

export interface CreateServerOptions {
  env?: NodeJS.ProcessEnv;
}

export interface CreatedServer {
  app: express.Express;
  config: ServerRuntimeConfig;
}

function normalizePort(rawPort: string | undefined): number {
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return DEFAULT_SERVER_PORT;
  }

  return parsedPort;
}

export function resolveServerRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ServerRuntimeConfig {
  const storageRootFromEnv = env.SERVER_STORAGE_ROOT?.trim();

  return {
    port: normalizePort(env.PORT),
    storageRootDirectory:
      storageRootFromEnv && storageRootFromEnv.length > 0
        ? path.resolve(storageRootFromEnv)
        : DEFAULT_STORAGE_ROOT,
  };
}

export function createServer(options: CreateServerOptions = {}): CreatedServer {
  const config = resolveServerRuntimeConfig(options.env);
  const serverHost = composeServerHost({
    logging: {
      verbosity: options.env?.LOG_VERBOSITY,
      level: "info",
    },
  });

  return {
    app: serverHost.createServerApp({
      storageRootDirectory: config.storageRootDirectory,
    }),
    config,
  };
}
