import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ArtifactIngestionFeature } from "../features/artifact-upload";
import { TabbedPanel } from "../components/ui/TabbedPanel";

export interface WorkspaceScopedPageProps { workspaceId?: string; workspaceName?: string; }
export function ArtifactsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-id={workspaceId} data-workspace-name={workspaceName}>
      <p>Active workspace: {workspaceName ?? workspaceId ?? "No active workspace"}</p>
      <TabbedPanel
        tabListAriaLabel="Artifact workspace panels"
        defaultTabId="ingestion"
        tabs={[
          {
            id: "ingestion",
            label: "Artifact Ingestion",
            content: <ArtifactIngestionFeature workspaceId={workspaceId} workspaceName={workspaceName} />,
          },
          {
            id: "browser",
            label: "Artifact Browser",
            content: <ArtifactBrowserFeature workspaceId={workspaceId} workspaceName={workspaceName} />,
          },
        ]}
      />
    </section>
  );
}

