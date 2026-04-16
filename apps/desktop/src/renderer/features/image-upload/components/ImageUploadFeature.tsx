import type { ImageUploadClient } from "../api/desktopImageUploadClient";
import { useImageUploadFeature } from "../hooks/useImageUploadFeature";
import { ImageUploadForm } from "./ImageUploadForm";
import { ImageUploadStatus } from "./ImageUploadStatus";

export interface ImageUploadFeatureProps {
  client?: ImageUploadClient;
}

export function ImageUploadFeature({ client }: ImageUploadFeatureProps) {
  const { selectedFile, viewState, onFileChange, onUploadSubmit } = useImageUploadFeature(client);

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Image upload</h2>
      <ImageUploadForm
        selectedFile={selectedFile}
        uploadStatus={viewState.status}
        onFileChange={onFileChange}
        onSubmit={(event) => void onUploadSubmit(event)}
      />
      <ImageUploadStatus viewState={viewState} />
    </section>
  );
}
