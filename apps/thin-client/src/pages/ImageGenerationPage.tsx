import { ImageGenerationFeature } from "../features/image-generation";

export interface WorkspaceScopedImageGenerationPageProps { workspaceId: string; workspaceName: string; onGenerated?: () => void; onNavigateToArtifacts?: () => void; onNavigateToModels?: () => void }

export function ImageGenerationPage({ workspaceId, workspaceName, onGenerated, onNavigateToArtifacts, onNavigateToModels }: WorkspaceScopedImageGenerationPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Image Generation</h1>
      <p>Showing records for: {workspaceName}</p>
      <ImageGenerationFeature key={workspaceId} workspaceId={workspaceId} workspaceName={workspaceName} onGenerated={onGenerated} onNavigateToArtifacts={onNavigateToArtifacts} onNavigateToModels={onNavigateToModels} />
    </section>
  );
}
