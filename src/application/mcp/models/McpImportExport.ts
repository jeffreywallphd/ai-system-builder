import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpServerImportExportRecord {
  readonly id: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly sourceType: "builtin-local" | "workspace-local" | "external-remote" | "imported";
  readonly command?: string;
  readonly args?: ReadonlyArray<string>;
  readonly url?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly connectOnStartup?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface McpImportResult {
  readonly imported: ReadonlyArray<McpServerDescriptor>;
  readonly checkedAt: string;
}

export interface McpExportResult {
  readonly servers: ReadonlyArray<McpServerImportExportRecord>;
  readonly checkedAt: string;
}
