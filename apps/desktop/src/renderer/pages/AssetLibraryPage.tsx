import { AssetLibraryFeature } from "../features/asset-library";

export interface WorkspaceScopedPageProps {
  workspaceId?: string;
  workspaceName?: string;
}

export function AssetLibraryPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Asset Library</h1>
      <p>Showing records for: {workspaceName ?? "No workspace selected"}</p>
      <p>Browse reusable building blocks available in this workspace.</p>
      <AssetLibraryFeature key={workspaceId} workspaceId={workspaceId} workspaceName={workspaceName} />
    </section>
  );
}
