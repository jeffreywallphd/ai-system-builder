import { ModelsFeature } from "../features/models";

export interface WorkspaceScopedPageProps {
  workspaceId?: string;
  workspaceName?: string;
}

export function ModelsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-id={workspaceId} data-workspace-name={workspaceName}>
      <h1>Model Management</h1>
      <p>Browse remote model references, manage model asset records, and prepare future training workflows.</p>
      <ModelsFeature />
    </section>
  );
}
