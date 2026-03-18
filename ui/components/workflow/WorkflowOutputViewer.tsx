import AssetViewer from "../assets/AssetViewer";
import type { WorkflowOutputViewModel } from "../../presenters/WorkflowOutputPresenter";

export interface WorkflowOutputViewerProps {
  readonly output: WorkflowOutputViewModel;
  readonly mode: "canvas" | "form";
}

export default function WorkflowOutputViewer({
  output,
  mode,
}: WorkflowOutputViewerProps): JSX.Element {
  return (
    <section
      className={`ui-output-viewer ui-output-viewer--${mode}`}
      aria-label="Workflow output viewer"
    >
      <div className="ui-output-viewer__header">
        <div className="ui-stack ui-stack--2xs">
          <div className="ui-heading-3">{output.title}</div>
          <div className="ui-text-secondary">{output.description}</div>
        </div>

        {output.expectedOutputTypes.length > 0 ? (
          <div className="ui-row ui-row--wrap">
            {output.expectedOutputTypes.map((typeLabel) => (
              <span key={typeLabel} className="ui-badge ui-badge--neutral">
                {typeLabel}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {output.assets.length > 0 ? (
        <div className="ui-output-viewer__stack">
          {output.primaryAsset ? <AssetViewer asset={output.primaryAsset} /> : null}

          {output.assets.length > 1 ? (
            <div className="ui-output-viewer__grid">
              {output.assets
                .slice(0, -1)
                .reverse()
                .map((asset) => (
                  <AssetViewer key={asset.id} asset={asset} />
                ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--xs">
            <div className="ui-heading-4">{output.emptyStateTitle}</div>
            <div className="ui-text-secondary">{output.emptyStateDescription}</div>
          </div>
        </div>
      )}
    </section>
  );
}
