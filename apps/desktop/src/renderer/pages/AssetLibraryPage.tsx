import { useMemo, useState } from "react";
import { AssetPackageManager } from "../../../../../modules/ui/shared/asset-package";
import { AssetStudioManager } from "../../../../../modules/ui/shared/asset-studio";

import { AssetAuthoringFeature } from "../features/asset-authoring/components/AssetAuthoringFeature";
import { AssetLibraryFeature } from "../features/asset-library";
import { AssetPlansTab } from "../features/asset-composition/components/AssetPlansTab";
import { createDesktopAssetCompositionClient } from "../features/asset-composition/api/desktopAssetCompositionClient";
import { createDesktopEffectiveAssetProjectionsClient } from "../features/effective-asset-projections/api/desktopEffectiveAssetProjectionsClient";
import { ConversationRunTestTab } from "../features/conversations/components/ConversationRunTestTab";
import { createDesktopAssetPackageClient } from "../features/asset-package/api/desktopAssetPackageClient";
import { createDesktopAssetStudioClient } from "../features/asset-studio/api/desktopAssetStudioClient";

export interface WorkspaceScopedPageProps {
  workspaceId: string;
  workspaceName: string;
}

type AssetsTab = "browse" | "packages" | "create" | "studio" | "drafts" | "customizations" | "plans" | "run-test";

export function AssetLibraryPage({ workspaceId }: WorkspaceScopedPageProps) {
  const [activeTab, setActiveTab] = useState<AssetsTab>("browse");

  return (
    <section className="ui-stack ui-stack--sm">
      <h1>Assets</h1>
      <div className="asset-library-tabs" role="tablist" aria-label="Assets sections">
        <button type="button" role="tab" aria-selected={activeTab === "browse"} onClick={() => setActiveTab("browse")}>Browse</button>
        <button type="button" role="tab" aria-selected={activeTab === "packages"} onClick={() => setActiveTab("packages")}>Import packages</button>
        <button type="button" role="tab" aria-selected={activeTab === "create"} onClick={() => setActiveTab("create")}>Create</button>
        <button type="button" role="tab" aria-selected={activeTab === "studio"} onClick={() => setActiveTab("studio")}>Studio</button>
        <button type="button" role="tab" aria-selected={activeTab === "drafts"} onClick={() => setActiveTab("drafts")}>Drafts</button>
        <button type="button" role="tab" aria-selected={activeTab === "customizations"} onClick={() => setActiveTab("customizations")}>Customizations</button>
        <button type="button" role="tab" aria-selected={activeTab === "plans"} onClick={() => setActiveTab("plans")}>Plans</button>
        <button type="button" role="tab" aria-selected={activeTab === "run-test"} onClick={() => setActiveTab("run-test")}>Run & Test</button>
      </div>
      {activeTab === "browse" ? <AssetLibraryFeature key={`assets-${workspaceId}`} workspaceId={workspaceId} /> : null}
      {activeTab === "packages" ? <DesktopAssetPackages workspaceId={workspaceId} /> : null}
      {activeTab === "create" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="create" /> : null}
      {activeTab === "studio" ? <DesktopAssetStudio workspaceId={workspaceId} /> : null}
      {activeTab === "drafts" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="drafts" /> : null}
      {activeTab === "customizations" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="customizations" /> : null}
      {activeTab === "plans" ? <AssetPlansTab workspaceId={workspaceId} client={createDesktopAssetCompositionClient()} projectionClient={createDesktopEffectiveAssetProjectionsClient()} /> : null}
      {activeTab === "run-test" ? <ConversationRunTestTab workspaceId={workspaceId} /> : null}
    </section>
  );
}

function DesktopAssetPackages({ workspaceId }: { readonly workspaceId: string }) {
  const client = useMemo(() => createDesktopAssetPackageClient(), []);
  return <AssetPackageManager workspaceId={workspaceId} client={client} />;
}

function DesktopAssetStudio({ workspaceId }: { readonly workspaceId: string }) {
  const client = useMemo(() => createDesktopAssetStudioClient(), []);
  return <AssetStudioManager workspaceId={workspaceId} client={client} />;
}
