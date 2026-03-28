import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

function statusLabel(status: "clean" | "warning" | "incompatible" | undefined): string {
  if (status === "clean") {
    return "Compatible";
  }
  if (status === "warning") {
    return "Attention needed";
  }
  if (status === "incompatible") {
    return "Incompatible";
  }
  return "Unavailable";
}

export function SystemCompatibilityInsightsPanel({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const compatibility = context.systemCompatibility;
  if (!compatibility) {
    return (
      <div className="ui-stack ui-stack--2xs" data-testid="system-compatibility-insights-panel">
        <strong>System compatibility insights</strong>
        <span className="ui-text-small ui-text-secondary">
          Compatibility insights are available after a system draft is created.
        </span>
      </div>
    );
  }

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-compatibility-insights-panel">
      <div className="ui-stack ui-stack--2xs">
        <strong>System compatibility insights</strong>
        <span className="ui-text-small ui-text-secondary">
          Recursive compatibility summary from shared system validation/enforcement outputs.
        </span>
      </div>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <span className="ui-badge">{statusLabel(compatibility.summary.status)}</span>
        <span className="ui-text-small ui-text-secondary">Issues: {compatibility.summary.totalIssueCount}</span>
      </div>
      <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
        <li className="ui-text-small">Incompatible child assets: {compatibility.summary.incompatibleChildAssetCount}</li>
        <li className="ui-text-small">Unresolved nested systems: {compatibility.summary.unresolvedNestedSystemCount}</li>
        <li className="ui-text-small">Binding incompatibilities: {compatibility.summary.bindingIncompatibilityCount}</li>
        <li className="ui-text-small">Interface mismatches: {compatibility.summary.interfaceMismatchCount}</li>
        <li className="ui-text-small">Configuration mismatches: {compatibility.summary.configurationMismatchCount}</li>
      </ul>
      {compatibility.summary.totalIssueCount > 0 ? (
        <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {compatibility.issues.slice(0, 6).map((issue) => (
            <li key={`${issue.code}:${issue.message}`} className="ui-text-small">
              <strong>{issue.code}</strong> · {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <span className="ui-text-small ui-text-secondary">No recursive compatibility issues detected.</span>
      )}
    </div>
  );
}
