import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ImageUploadFeature } from "../features/image-upload";

export function HomePage() {
  return (
    <>
      <ImageUploadFeature />
      <ArtifactBrowserFeature />
    </>
  );
}
