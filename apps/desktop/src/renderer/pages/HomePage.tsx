import type { DesktopImageUploadApi } from "../lib/desktopApi";

import { ImageUploadFeature } from "../features/image-upload/components/ImageUploadFeature";

export interface HomePageProps {
  uploadApi?: DesktopImageUploadApi;
}

export function HomePage({ uploadApi }: HomePageProps) {
  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Home</h2>
      <p>Desktop image upload starter flow.</p>
      <ImageUploadFeature uploadApi={uploadApi} />
    </section>
  );
}
