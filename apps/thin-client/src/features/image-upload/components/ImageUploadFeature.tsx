import type { ApiImageUploadClient } from "../api/apiImageUploadClient";
import { useImageUploadFeature } from "../hooks/useImageUploadFeature";
import { ImageUploadForm } from "./ImageUploadForm";
import { ImageUploadStatus } from "./ImageUploadStatus";

export interface ImageUploadFeatureProps {
  client?: ApiImageUploadClient;
  onUploadComplete?: (storageKey: string) => void;
}

export function ImageUploadFeature({ client, onUploadComplete }: ImageUploadFeatureProps) {
  const { selectedFile, viewState, onFileChange, onUploadSubmit } = useImageUploadFeature(client, onUploadComplete);

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2>Image upload</h2>
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
