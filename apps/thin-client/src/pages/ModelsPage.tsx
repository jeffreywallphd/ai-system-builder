import { ModelManagementFeature } from "../features/model-management";
export interface WorkspaceScopedPageProps { workspaceId?: string; workspaceName?: string; }
export function ModelsPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}){ return <section data-workspace-id={workspaceId} data-workspace-name={workspaceName}><ModelManagementFeature /></section>; }
