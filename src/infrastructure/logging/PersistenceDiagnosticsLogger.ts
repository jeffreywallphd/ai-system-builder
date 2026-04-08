import { sanitizePersistenceDiagnostics } from "./PersistenceRedaction";
import type {
  ImageManipulationSliceCorrelation,
  ImageManipulationSliceResilienceDiagnostic,
} from "./ImageManipulationSliceDiagnostics";

export type PersistenceDiagnosticsLogLevel = "info" | "warn" | "error";

export interface PersistenceDiagnosticsLogEvent {
  readonly type: "persistence-diagnostic";
  readonly slice?: "image-manipulation";
  readonly level: PersistenceDiagnosticsLogLevel;
  readonly repository: string;
  readonly operation: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
  readonly correlation?: Readonly<ImageManipulationSliceCorrelation>;
  readonly resilience?: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IPersistenceDiagnosticsLogger {
  info(event: PersistenceDiagnosticsLogEvent): void;
  warn(event: PersistenceDiagnosticsLogEvent): void;
  error(event: PersistenceDiagnosticsLogEvent): void;
}

export class ConsolePersistenceDiagnosticsLogger implements IPersistenceDiagnosticsLogger {
  public info(event: PersistenceDiagnosticsLogEvent): void {
    console.info(JSON.stringify(sanitizePersistenceDiagnostics(event)));
  }

  public warn(event: PersistenceDiagnosticsLogEvent): void {
    console.warn(JSON.stringify(sanitizePersistenceDiagnostics(event)));
  }

  public error(event: PersistenceDiagnosticsLogEvent): void {
    console.error(JSON.stringify(sanitizePersistenceDiagnostics(event)));
  }
}

export class NoOpPersistenceDiagnosticsLogger implements IPersistenceDiagnosticsLogger {
  public info(_event: PersistenceDiagnosticsLogEvent): void {}

  public warn(_event: PersistenceDiagnosticsLogEvent): void {}

  public error(_event: PersistenceDiagnosticsLogEvent): void {}
}
