import type { JSX } from "react";
import type { ImageRunLineageView } from "../../../../application/system-runtime/ImageRunLineageDataContract";

function labelForKind(kind: ImageRunLineageView["nodes"][number]["kind"]): string {
  switch (kind) {
    case "input-image":
      return "Input";
    case "workflow-run":
      return "Run";
    case "output-image":
      return "Output";
    case "output-dataset":
      return "Dataset";
    default:
      return kind;
  }
}

export function ImageLineageMiniView({ lineage }: { readonly lineage?: ImageRunLineageView }): JSX.Element {
  if (!lineage) {
    return <section className="ui-image-surface ui-image-surface--status">No lineage available for the selected run.</section>;
  }

  return (
    <section className="ui-image-surface ui-image-lineage-mini-view">
      <header className="ui-image-surface__header">
        <h4 className="ui-image-surface__title">Lineage mini-view</h4>
        <span className="ui-text-small ui-text-secondary">run: {lineage.summary.runId}</span>
      </header>
      <div className="ui-image-lineage-mini-view__summary ui-text-small ui-text-secondary">
        <span>inputs: {lineage.summary.inputCount}</span>
        <span>outputs: {lineage.summary.outputCount}</span>
        <span>dataset: {lineage.summary.datasetInstanceId ?? "n/a"}</span>
      </div>
      <ul className="ui-image-lineage-mini-view__edge-list">
        {lineage.edges.map((edge) => {
          const from = lineage.nodes.find((node) => node.nodeId === edge.fromNodeId);
          const to = lineage.nodes.find((node) => node.nodeId === edge.toNodeId);
          return (
            <li key={edge.edgeId} className="ui-image-lineage-mini-view__edge-item ui-image-item-card">
              <span className="ui-text-small">
                <strong>{labelForKind(from?.kind ?? "input-image")}</strong> {from?.label ?? edge.fromNodeId}
              </span>
              <span className="ui-text-small ui-text-secondary">→</span>
              <span className="ui-text-small">
                <strong>{labelForKind(to?.kind ?? "output-image")}</strong> {to?.label ?? edge.toNodeId}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
