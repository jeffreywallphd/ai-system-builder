import type { StudioShellValidationIssue } from "../../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import { StudioShellPanel } from "./StudioShellPanel";

export interface StudioShellValidationIssuesPanelProps {
  readonly operationError?: string;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
}

export function StudioShellValidationIssuesPanel({ operationError, validationIssues }: StudioShellValidationIssuesPanelProps): JSX.Element {
  if (!operationError && validationIssues.length === 0) {
    return (
      <StudioShellPanel title="Validation and errors" subtitle="Backend-authoritative validation and operation failures.">
        <p className="ui-text-muted">No validation issues.</p>
      </StudioShellPanel>
    );
  }

  return (
    <StudioShellPanel title="Validation and errors" subtitle="Backend-authoritative validation and operation failures.">
      {operationError ? <div className="ui-banner ui-banner--danger">{operationError}</div> : null}
      {validationIssues.length > 0 ? (
        <ul className="ui-stack ui-stack--xs">
          {validationIssues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <strong>{issue.section}</strong>: {issue.message} <span className="ui-text-muted">[{issue.severity}]</span>
            </li>
          ))}
        </ul>
      ) : null}
    </StudioShellPanel>
  );
}
