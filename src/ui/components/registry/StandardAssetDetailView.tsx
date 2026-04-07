import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { RegistryAsset } from "../../../src/domain/asset-registry/RegistryAsset";
import { AssetDetailLayoutResolver, AssetDetailSectionKeys } from "../../../application/asset-registry/AssetDetailPresentationModel";
import type { AssetActionContext } from "../../routes/AssetIntentActions";
import { AssetActionExecutionService, AssetIntentActionResolver } from "../../routes/AssetIntentActions";

export interface StandardAssetDetailViewProps {
  readonly asset: RegistryAsset;
  readonly actionContext: AssetActionContext;
  readonly backPath: string;
}

export function StandardAssetDetailView({ asset, actionContext, backPath }: StandardAssetDetailViewProps): JSX.Element {
  const model = useMemo(() => new AssetDetailLayoutResolver().resolve(asset), [asset]);
  const actions = useMemo(() => new AssetIntentActionResolver().resolveActions(actionContext), [actionContext]);
  const executionService = useMemo(() => new AssetActionExecutionService(), []);

  const summarySection = model.sections.find((entry) => entry.key === AssetDetailSectionKeys.summary);
  const relationshipSection = model.sections.find((entry) => entry.key === AssetDetailSectionKeys.relationships);
  const structureSection = model.sections.find((entry) => entry.key === AssetDetailSectionKeys.structure);
  const metadataSections = model.sections.filter((entry) => entry.progressive === "advanced");

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="standard-asset-detail-view">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy ui-stack ui-stack--2xs">
          <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
            <h1 className="ui-page__title" style={{ margin: 0 }}>{model.title}</h1>
            <Link className="ui-button ui-button--ghost ui-button--small" to={backPath}>Back to results</Link>
          </div>
          <p className="ui-page__subtitle" style={{ margin: 0 }}>{model.summary}</p>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            <span className="ui-badge">Status: {model.identity.status}</span>
            <span className="ui-badge">Kind: {model.identity.kind}</span>
            <span className="ui-badge">Version: {model.identity.versionId ?? "Unavailable"}</span>
          </div>
        </div>
      </div>

      <section className="ui-card" data-testid="standard-asset-detail-actions">
        <div className="ui-card__body ui-stack ui-stack--xs">
          <h2 style={{ margin: 0 }}>Primary actions</h2>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            {actions.map((action) => {
              const result = action.enabled ? executionService.execute(action.type, actionContext) : undefined;
              if (!result) {
                return <span key={action.type} className="ui-pill ui-pill--neutral">{action.label}</span>;
              }
              return (
                <Link key={action.type} className="ui-button ui-button--ghost ui-button--small" to={result.launchPath}>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
        {[summarySection, structureSection, relationshipSection].filter(Boolean).map((section) => (
          <section key={section?.key} className="ui-card" data-testid={`standard-asset-detail-section-${section?.key}`}>
            <div className="ui-card__body ui-stack ui-stack--xs">
              <h2 style={{ margin: 0 }}>{section?.title}</h2>
              {section?.items.map((item) => (
                <div key={`${section.key}-${item.label}`} className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
                  <span className="ui-text-secondary">{item.label}</span>
                  <span className={item.emphasis === "primary" ? "" : "ui-text-small"}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <details>
        <summary className="ui-text-small" style={{ cursor: "pointer" }}>Advanced metadata and diagnostics</summary>
        <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          {metadataSections.map((section) => (
            <section key={section.key} className="ui-card" data-testid={`standard-asset-detail-section-${section.key}`}>
              <div className="ui-card__body ui-stack ui-stack--xs">
                <h3 style={{ margin: 0 }}>{section.title}</h3>
                {section.items.map((item) => (
                  <div key={`${section.key}-${item.label}`} className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
                    <span className="ui-text-secondary">{item.label}</span>
                    <span className="ui-text-small">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}
