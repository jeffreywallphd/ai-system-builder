import { ImageUploadFeature } from "../features/image-upload/components/ImageUploadFeature";

export function HomePage() {
  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Home</h2>
      <p>Desktop image upload starter flow.</p>
      <ImageUploadFeature />
    </section>
  );
}
