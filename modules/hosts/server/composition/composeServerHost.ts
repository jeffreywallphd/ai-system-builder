import type { LoggingPort } from "../../../application/ports/logging";
import { StoreImageUploadUseCase } from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import { createFilesystemArtifactStorageAdapter } from "../../../adapters/storage/filesystem";
import {
  registerExpressApi,
  type ExpressPostRoutePort,
} from "../../../adapters/transport/api-express/registerExpressApi";
import { createLoggingConfig, type LoggingConfig } from "../../../contracts/config";
import type { LogLevel, LogVerbosity } from "../../../contracts/logging";

export interface ComposeServerHostLoggingOptions {
  verbosity?: string;
  fallbackVerbosity?: LogVerbosity;
  level?: LogLevel;
  includeDiagnostics?: boolean;
}

export interface ComposeServerHostOptions {
  logging?: ComposeServerHostLoggingOptions;
  logSink?: StructuredLogSink;
  now?: () => string;
}

export interface RegisterServerApiOptions {
  app: ExpressPostRoutePort;
  storageRootDirectory: string;
}

export interface ServerHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  registerApi: (options: RegisterServerApiOptions) => void;
}

export function composeServerHost(
  options: ComposeServerHostOptions = {},
): ServerHostComposition {
  const loggingConfig = createLoggingConfig({
    verbosity: options.logging?.verbosity,
    fallbackVerbosity: options.logging?.fallbackVerbosity,
    level: options.logging?.level,
    includeDiagnostics: options.logging?.includeDiagnostics,
  });

  const loggingPort = createLogger({
    config: loggingConfig,
    host: "server",
    component: "server-host",
    sink: options.logSink,
    now: options.now,
  });

  return {
    loggingPort,
    loggingConfig,
    registerApi(registerOptions) {
      const storage = createFilesystemArtifactStorageAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
        host: "server",
        logging: loggingPort,
        now: options.now,
      });

      const storeImageUploadUseCase = new StoreImageUploadUseCase({
        storage,
        logging: loggingPort,
        now: options.now,
      });

      registerExpressApi({
        app: registerOptions.app,
        storeImageUploadUseCase,
      });
    },
  };
}
