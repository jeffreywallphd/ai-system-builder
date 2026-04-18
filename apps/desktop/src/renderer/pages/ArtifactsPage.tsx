import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ArtifactUploadFeature } from "../features/artifact-upload/components/ArtifactUploadFeature";

export interface ArtifactsPageProps {
  refreshToken: number;
  onUploaded: () => void;
}

export function ArtifactsPage({ refreshToken, onUploaded }: ArtifactsPageProps) {
  return (
    <section className="ui-stack ui-stack--sm" data-refresh-token={refreshToken}>
      <ArtifactUploadFeature onUploadComplete={onUploaded} />
      <ArtifactBrowserFeature key={refreshToken} />
    </section>
  );
}
