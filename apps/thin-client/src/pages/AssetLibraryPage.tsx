import { useState } from "react";

import { AssetAuthoringFeature } from "../features/asset-authoring/components/AssetAuthoringFeature";
import { AssetLibraryFeature } from "../features/asset-library";
import { AssetPlansTab } from "../features/asset-composition/components/AssetPlansTab";
import { createThinClientAssetCompositionClient } from "../features/asset-composition/api/thinClientAssetCompositionClient";
import { createThinClientEffectiveAssetProjectionsClient } from "../features/effective-asset-projections/api/thinClientEffectiveAssetProjectionsClient";
import { ConversationRunTestTab } from "../features/conversations/components/ConversationRunTestTab";

export interface WorkspaceScopedPageProps {
  workspaceId: string;
  workspaceName: string;
}

type AssetsTab = "browse" | "create" | "drafts" | "customizations" | "plans" | "run-test";

export function AssetLibraryPage({ workspaceId, workspaceName }: WorkspaceScopedPageProps) {
  const [activeTab, setActiveTab] = useState<AssetsTab>("browse");

  return (
    <section className="ui-stack ui-stack--sm" data-workspace-name={workspaceName}>
      <h1>Assets</h1>
      <p>Manage assets for {workspaceName}.</p>
      <div className="asset-library-tabs" role="tablist" aria-label="Assets sections">
        <button type="button" role="tab" aria-selected={activeTab === "browse"} onClick={() => setActiveTab("browse")}>Browse</button>
        <button type="button" role="tab" aria-selected={activeTab === "create"} onClick={() => setActiveTab("create")}>Create</button>
        <button type="button" role="tab" aria-selected={activeTab === "drafts"} onClick={() => setActiveTab("drafts")}>Drafts</button>
        <button type="button" role="tab" aria-selected={activeTab === "customizations"} onClick={() => setActiveTab("customizations")}>Customizations</button>
        <button type="button" role="tab" aria-selected={activeTab === "plans"} onClick={() => setActiveTab("plans")}>Plans</button>
        <button type="button" role="tab" aria-selected={activeTab === "run-test"} onClick={() => setActiveTab("run-test")}>Run & Test</button>
      </div>
      {activeTab === "browse" ? <AssetLibraryFeature key={`assets-${workspaceId}`} workspaceId={workspaceId} workspaceName={workspaceName} /> : null}
      {activeTab === "create" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="create" /> : null}
      {activeTab === "drafts" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="drafts" /> : null}
      {activeTab === "customizations" ? <AssetAuthoringFeature workspaceId={workspaceId} initialSection="customizations" /> : null}
      {activeTab === "plans" ? <AssetPlansTab workspaceId={workspaceId} client={createThinClientAssetCompositionClient()} projectionClient={createThinClientEffectiveAssetProjectionsClient()} /> : null}
      {activeTab === "run-test" ? <ConversationRunTestTab workspaceId={workspaceId} /> : null}
    </section>
  );
}
