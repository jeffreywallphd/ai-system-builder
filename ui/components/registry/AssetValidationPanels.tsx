import type { ReactNode } from "react";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";

function DetailPanel({
  title,
  testId,
  children,
}: {
  readonly title: string;
  readonly testId: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className="ui-card" data-testid={testId}>
      <div className="ui-card__body ui-stack ui-stack--xs">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function toStatusLabel(status?: RegistryAsset["validation"]["status"]): string {
  if (status === "invalid") {
    return "Invalid";
  }
  if (status === "warning") {
    return "Warnings";
  }
  return "Valid";
}

export function AssetValidationSummary({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  const validation = asset.validation;
  return (
    <DetailPanel title="Validation Summary" testId="registry-asset-validation-summary-panel">
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <span className="ui-badge">{toStatusLabel(validation?.status)}</span>
        <span className="ui-text-small ui-text-secondary">
          {validation?.errorCount ?? 0} error(s) · {validation?.warningCount ?? 0} warning(s)
        </span>
      </div>
      <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
        {validation?.issueCount
          ? "Registry projects validation from shared Studio Shell rules."
          : "No validation issues are currently projected for this asset."}
      </p>
      {(validation?.issues ?? []).slice(0, 3).map((issue) => (
        <p key={`${issue.code}:${issue.path ?? ""}`} className="ui-text-small" style={{ margin: 0 }}>
          <strong>{issue.severity.toUpperCase()}</strong> · {issue.message}
        </p>
      ))}
    </DetailPanel>
  );
}

export function DependencyCompatibilityPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  const validation = asset.validation;
  const incompatibleCount = validation?.incompatibleDependencyCount ?? 0;
  const dependencyIssues = (validation?.issues ?? []).filter((issue) => issue.section === "dependencies");

  return (
    <DetailPanel title="Dependency Compatibility" testId="registry-asset-dependency-compatibility-panel">
      <p className="ui-text-small" style={{ margin: 0 }}>
        Incompatible dependencies: {incompatibleCount}
      </p>
      {dependencyIssues.length === 0 ? (
        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
          All currently projected dependencies are compatible with this asset's role and version constraints.
        </p>
      ) : (
        <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {dependencyIssues.slice(0, 4).map((issue) => (
            <li key={`${issue.code}:${issue.path ?? issue.message}`}>
              <span className="ui-text-small">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </DetailPanel>
  );
}
