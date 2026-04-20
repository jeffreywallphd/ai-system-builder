import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ArtifactIngestionFeature } from "../features/artifact-upload/components/ArtifactIngestionFeature";

export interface ArtifactsPageProps {
  refreshToken: number;
  onUploaded: () => void;
}

export function ArtifactsPage({ refreshToken, onUploaded }: ArtifactsPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-refresh-token={refreshToken}>
      <ArtifactIngestionFeature onUploadComplete={onUploaded} />
      <ArtifactBrowserFeature key={refreshToken} />
    </section>
  );
}

