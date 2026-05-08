import { AssetLibraryFeature } from "../features/asset-library";

export function AssetLibraryPage() {
  return (
    <section className="ui-stack ui-stack--sm">
      <h1>Asset Library</h1>
      <p>Browse reusable building blocks available in this workspace.</p>
      <AssetLibraryFeature />
    </section>
  );
}
