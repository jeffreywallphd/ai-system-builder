import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ImageUploadFeature } from "../features/image-upload/components/ImageUploadFeature";

export interface ArtifactsPageProps {
  refreshToken: number;
  onUploaded: () => void;
}

export function ArtifactsPage({ refreshToken, onUploaded }: ArtifactsPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-refresh-token={refreshToken}>
      <ImageUploadFeature onUploadComplete={onUploaded} />
      <ArtifactBrowserFeature key={refreshToken} />
    </section>
  );
}
