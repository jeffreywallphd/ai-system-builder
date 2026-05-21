import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ArtifactIngestionFeature } from "../features/artifact-upload";
import { TabbedPanel } from "../components/ui/TabbedPanel";

export interface WorkspaceScopedPageProps { workspaceId: string; workspaceName: string; }
export function ArtifactsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Data Management</h1>
      <p>Showing records for: {workspaceName}</p>
      <TabbedPanel
        tabListAriaLabel="Artifact workspace panels"
        defaultTabId="ingestion"
        tabs={[
          {
            id: "ingestion",
            label: "Artifact Ingestion",
            content: <ArtifactIngestionFeature key={`ingest-${workspaceId}`} workspaceId={workspaceId} workspaceName={workspaceName} />,
          },
          {
            id: "browser",
            label: "Artifact Browser",
            content: <ArtifactBrowserFeature key={`browser-${workspaceId}`} workspaceId={workspaceId} workspaceName={workspaceName} />,
          },
        ]}
      />
    </section>
  );
}
