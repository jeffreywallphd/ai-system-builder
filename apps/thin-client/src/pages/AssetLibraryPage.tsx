import { AssetLibraryFeature } from "../features/asset-library";

export interface WorkspaceScopedPageProps { workspaceId?: string; workspaceName?: string; }
export function AssetLibraryPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-id={workspaceId} data-workspace-name={workspaceName}>
      <h1>Asset Library</h1>
      <p>Browse reusable building blocks available in this workspace.</p>
      <AssetLibraryFeature />
    </section>
  );
}
