import type { AgentSessionDetailReadModel } from "../../../application/agents/contracts/AgentRunContracts";
import type { CanonicalAssetManagementService } from "../../services/CanonicalAssetManagementService";
import { OutputAssetExplorerPanel } from "./OutputAssetExplorerPanel";

interface SessionDiagnosticAssetsPanelProps {
  readonly session: AgentSessionDetailReadModel;
  readonly canonicalAssetManagementService: CanonicalAssetManagementService;
}

export function SessionDiagnosticAssetsPanel(props: SessionDiagnosticAssetsPanelProps): JSX.Element {
  const diagnosticReferences = props.session.operational.diagnosticSummary.assetReferences;
  return (
    <section className="ui-stack ui-stack--xs" aria-label="Diagnostics and outputs">
      <h4 className="ui-heading-4">Outputs and diagnostic assets</h4>
      <p className="ui-text-secondary">Diagnostic references: {props.session.operational.diagnosticSummary.count}</p>
      {diagnosticReferences.length > 0 ? (
        <ul className="ui-stack ui-stack--xs">
          {diagnosticReferences.map((reference, index) => (
            <li key={`${reference.assetId}-${reference.assetVersionId ?? "latest"}-${index}`} className="ui-text-secondary">
              {reference.assetId}
              {reference.assetVersionId ? ` @ ${reference.assetVersionId}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-text-secondary">No diagnostic asset references were persisted.</p>
      )}
      <OutputAssetExplorerPanel
        title="Session output assets"
        canonicalAssetManagementService={props.canonicalAssetManagementService}
        assetIds={props.session.operational.outcomeSummary.outputAssetIds}
        emptyMessage="This session has no output asset references."
      />
    </section>
  );
}
