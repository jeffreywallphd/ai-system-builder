import { ModelManagementFeature } from "../features/model-management";
export interface WorkspaceScopedPageProps { workspaceId?: string; workspaceName?: string; }
export function ModelsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Model Management</h1>
      <p>Showing records for: {workspaceName ?? "No workspace selected"}</p>
      <ModelManagementFeature key={workspaceId} workspaceId={workspaceId} workspaceName={workspaceName} />
    </section>
  );
}
