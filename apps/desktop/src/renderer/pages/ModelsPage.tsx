import { ModelsFeature } from "../features/models";

export interface WorkspaceScopedPageProps {
  workspaceId: string;
  workspaceName: string;
}

export function ModelsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Model Management</h1>
      <p>Showing records for: {workspaceName}</p>
      <p>Browse remote model references, manage model asset records, and prepare future training workflows.</p>
      <ModelsFeature key={workspaceId} workspaceId={workspaceId} workspaceName={workspaceName} />
    </section>
  );
}
