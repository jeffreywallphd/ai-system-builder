import { ImageGenerationFeature } from "../features/image-generation";

export interface WorkspaceScopedImageGenerationPageProps { workspaceId?: string; workspaceName?: string; onGenerated?: () => void; onNavigateToArtifacts?: () => void; onNavigateToModels?: () => void }

export function ImageGenerationPage({ workspaceId, workspaceName, onGenerated, onNavigateToArtifacts, onNavigateToModels }: WorkspaceScopedImageGenerationPageProps = {}) {
  return <section data-workspace-id={workspaceId} data-workspace-name={workspaceName}><ImageGenerationFeature onGenerated={onGenerated} onNavigateToArtifacts={onNavigateToArtifacts} onNavigateToModels={onNavigateToModels} /></section>;
}
