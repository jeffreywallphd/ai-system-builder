import type { LoggingPort } from "../../../application/ports/logging";
import { StoreImageUploadUseCase } from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import { createFilesystemArtifactStorageAdapter } from "../../../adapters/storage/filesystem";
import {
  registerElectronIpc,
  type IpcMainHandlePort,
} from "../../../adapters/transport/ipc-electron/registerElectronIpc";
import { createLoggingConfig, type LoggingConfig } from "../../../contracts/config";
import type { LogLevel, LogVerbosity } from "../../../contracts/logging";

export interface ComposeDesktopHostLoggingOptions {
  verbosity?: string;
  fallbackVerbosity?: LogVerbosity;
  level?: LogLevel;
  includeDiagnostics?: boolean;
}

export interface ComposeDesktopHostOptions {
  logging?: ComposeDesktopHostLoggingOptions;
  logSink?: StructuredLogSink;
  now?: () => string;
}

export interface RegisterDesktopImageUploadIpcOptions {
  ipcMain: IpcMainHandlePort;
  storageRootDirectory: string;
}

export interface DesktopHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  registerImageUploadIpc: (options: RegisterDesktopImageUploadIpcOptions) => void;
}

export function composeDesktopHost(
  options: ComposeDesktopHostOptions = {},
): DesktopHostComposition {
  const loggingConfig = createLoggingConfig({
    verbosity: options.logging?.verbosity,
    fallbackVerbosity: options.logging?.fallbackVerbosity,
    level: options.logging?.level,
    includeDiagnostics: options.logging?.includeDiagnostics,
  });

  const loggingPort = createLogger({
    config: loggingConfig,
    host: "desktop",
    component: "desktop-host",
    sink: options.logSink,
    now: options.now,
  });

  return {
    loggingPort,
    loggingConfig,
    registerImageUploadIpc(registerOptions) {
      const storage = createFilesystemArtifactStorageAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
        host: "desktop",
        logging: loggingPort,
        now: options.now,
      });
      const storeImageUploadUseCase = new StoreImageUploadUseCase({
        storage,
        logging: loggingPort,
        now: options.now,
      });

      registerElectronIpc({
        ipcMain: registerOptions.ipcMain,
        storeImageUploadUseCase,
      });
    },
  };
}
