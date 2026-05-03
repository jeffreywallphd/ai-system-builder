import { ImageGenerationFeature } from "../features/image-generation";

export function ImageGenerationPage({ onGenerated, onNavigateToArtifacts, onNavigateToModels }: { onGenerated?: () => void; onNavigateToArtifacts?: () => void; onNavigateToModels?: () => void } = {}) {
  return <ImageGenerationFeature onGenerated={onGenerated} onNavigateToArtifacts={onNavigateToArtifacts} onNavigateToModels={onNavigateToModels} />;
}
import { ImageGenerationFeature } from "../features/image-generation/components/ImageGenerationFeature";
export function ImageGenerationPage(){ return <ImageGenerationFeature />; }
