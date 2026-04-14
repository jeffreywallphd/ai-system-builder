import type { LogLevel, LogVerbosity } from "../logging";

export type RuntimeExecutionDiagnosticData = Readonly<Record<string, unknown>>;

export interface RuntimeExecutionDiagnostic<
  TData extends RuntimeExecutionDiagnosticData = RuntimeExecutionDiagnosticData,
> {
  timestamp: string;
  level: LogLevel;
  verbosity: LogVerbosity;
  event: string;
  message: string;
  component: string;
  data?: TData;
  errorCode?: string;
}
