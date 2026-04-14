import {
  createHostConfig,
  type HostConfig,
} from "./host-config";
import {
  createLoggingConfig,
  type LoggingConfig,
} from "./logging-config";
import type { PersistenceConfig } from "./persistence-config";
import {
  createRuntimeConfig,
  type RuntimeConfig,
} from "./runtime-config";
import type { StorageConfig } from "./storage-config";

export interface SystemConfig {
  host: HostConfig;
  runtime: RuntimeConfig;
  logging: LoggingConfig;
  persistence?: PersistenceConfig;
  storage?: StorageConfig;
}

export function createSystemConfig(options?: {
  host?: HostConfig;
  runtime?: RuntimeConfig;
  logging?: LoggingConfig;
  persistence?: PersistenceConfig;
  storage?: StorageConfig;
}): SystemConfig {
  return {
    host: options?.host ?? createHostConfig(),
    runtime: options?.runtime ?? createRuntimeConfig(),
    logging: options?.logging ?? createLoggingConfig(),
    persistence: options?.persistence,
    storage: options?.storage,
  };
}
