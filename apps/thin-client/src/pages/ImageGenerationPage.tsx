import { ImageGenerationFeature } from "../features/image-generation";

export function ImageGenerationPage({ onGenerated, onNavigateToArtifacts }: { onGenerated?: () => void; onNavigateToArtifacts?: () => void } = {}) {
  return <ImageGenerationFeature onGenerated={onGenerated} onNavigateToArtifacts={onNavigateToArtifacts} />;
}
