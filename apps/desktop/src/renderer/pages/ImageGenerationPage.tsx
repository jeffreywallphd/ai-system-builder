import { ImageGenerationFeature } from "../features/image-generation";

export interface WorkspaceScopedPageProps {
  workspaceId?: string;
  workspaceName?: string;
}

export function ImageGenerationPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps = {}) {
  return <section className="ui-stack ui-stack--sm" data-workspace-id={workspaceId} data-workspace-name={workspaceName}><h1>Image Generation</h1><p>Run runtime-backed image generation tasks and track progress to finalized assets.</p><ImageGenerationFeature /></section>;
}
