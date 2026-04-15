import type { DesktopImageUploadApi } from "../lib/desktopApi";

import { ImageUploadFeature } from "../features/image-upload/components/ImageUploadFeature";

export interface HomePageProps {
  uploadApi?: DesktopImageUploadApi;
}

export function HomePage({ uploadApi }: HomePageProps) {
  return (
    <section>
      <h2>Home</h2>
      <p>Desktop image upload starter flow.</p>
      <ImageUploadFeature uploadApi={uploadApi} />
    </section>
  );
}
