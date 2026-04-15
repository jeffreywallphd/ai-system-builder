import express from "express";

import type { LoggingPort } from "../../../application/ports/logging";
import { StoreImageUploadUseCase } from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import { createDesktopFilesystemArtifactStorageAdapter } from "../../../adapters/storage/filesystem";
import { registerExpressApi } from "../../../adapters/transport/api-express/registerExpressApi";
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

export interface ComposeServerAppOptions {
  storageRootDirectory: string;
}

export interface ServerHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  createServerApp: (options: ComposeServerAppOptions) => express.Express;
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
    createServerApp(createOptions) {
      const app = express();
      app.use(express.json({ limit: "5mb" }));

      const storage = createDesktopFilesystemArtifactStorageAdapter({
        rootDirectory: createOptions.storageRootDirectory,
        logging: loggingPort,
        now: options.now,
      });

      const storeImageUploadUseCase = new StoreImageUploadUseCase({
        storage,
        logging: loggingPort,
        now: options.now,
      });

      registerExpressApi({
        app,
        storeImageUploadUseCase,
      });

      return app;
    },
  };
}
