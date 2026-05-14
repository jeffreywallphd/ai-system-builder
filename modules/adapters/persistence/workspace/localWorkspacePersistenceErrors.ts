export type LocalWorkspacePersistenceErrorCode =
  | "workspace-persistence-read-failed"
  | "workspace-persistence-write-failed"
  | "workspace-persistence-invalid-record"
  | "workspace-selection-persistence-read-failed"
  | "workspace-selection-persistence-write-failed"
  | "workspace-activation-persistence-read-failed"
  | "workspace-activation-persistence-write-failed";

const SAFE_MESSAGES: Record<LocalWorkspacePersistenceErrorCode, string> = {
  "workspace-persistence-read-failed": "Workspace persistence could not be read.",
  "workspace-persistence-write-failed": "Workspace persistence could not be written.",
  "workspace-persistence-invalid-record": "Workspace persistence contains an invalid record.",
  "workspace-selection-persistence-read-failed": "Workspace selection persistence could not be read.",
  "workspace-selection-persistence-write-failed": "Workspace selection persistence could not be written.",
  "workspace-activation-persistence-read-failed": "Workspace activation persistence could not be read.",
  "workspace-activation-persistence-write-failed": "Workspace activation persistence could not be written.",
};

export class LocalWorkspacePersistenceError extends Error {
  public readonly code: LocalWorkspacePersistenceErrorCode;

  public constructor(code: LocalWorkspacePersistenceErrorCode, _options?: ErrorOptions) {
    super(SAFE_MESSAGES[code]);
    this.name = "LocalWorkspacePersistenceError";
    this.code = code;
    this.stack = undefined;
  }
}
