import { useMemo, useState } from "react";
import {
  SystemBuilderWorkspace,
  SystemBuildReleaseWorkflow,
  SystemDataRunTest,
  SystemReviewRunTest,
  SystemDeploymentWorkflow,
} from "../../../../../modules/ui/shared/system-builder";
import { AssetPlansTab } from "../features/asset-composition/components/AssetPlansTab";
import { createDesktopAssetCompositionClient } from "../features/asset-composition/api/desktopAssetCompositionClient";
import { createDesktopEffectiveAssetProjectionsClient } from "../features/effective-asset-projections/api/desktopEffectiveAssetProjectionsClient";
import { ConversationRunTestTab } from "../features/conversations/components/ConversationRunTestTab";
import { createDesktopSystemBuilderClient } from "../features/system-builder/api/desktopSystemBuilderClient";
import { createDesktopSystemBuildClient } from "../features/system-builder/api/desktopSystemBuildClient";

import { createDesktopSystemDataClient } from "../features/system-builder/api/desktopSystemDataClient";
import { createDesktopSystemReviewClient } from "../features/system-builder/api/desktopSystemReviewClient";
import { createDesktopSystemDeploymentClient } from "../features/system-builder/api/desktopSystemDeploymentClient";
export interface SystemBuilderPageProps {
  readonly workspaceId: string;
  readonly workspaceName: string;
}
type SystemsTab = "compose" | "plans" | "build-release" | "run-test";

export function SystemBuilderPage({
  workspaceId,
  workspaceName,
}: SystemBuilderPageProps) {
  const [activeTab, setActiveTab] = useState<SystemsTab>("compose");
  const client = useMemo(() => createDesktopSystemBuilderClient(), []);
  const buildClient = useMemo(() => createDesktopSystemBuildClient(), []);
  const dataClient = useMemo(() => createDesktopSystemDataClient(), []);
  const reviewClient = useMemo(() => createDesktopSystemReviewClient(), []);
  const deploymentClient = useMemo(
    () => createDesktopSystemDeploymentClient(),
    [],
  );
  return (
    <section className="ui-stack ui-stack--sm" aria-labelledby="systems-title">
      <header className="ui-stack ui-stack--sm">
        <h1 id="systems-title">Systems</h1>
        <p className="ui-text-muted">
          Build systems in {workspaceName} from reusable, versioned assets.
        </p>
      </header>
      <div
        className="asset-library-tabs"
        role="tablist"
        aria-label="System Builder sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "compose"}
          onClick={() => setActiveTab("compose")}
        >
          Compose
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "plans"}
          onClick={() => setActiveTab("plans")}
        >
          Plans
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "build-release"}
          onClick={() => setActiveTab("build-release")}
        >
          Build &amp; Release
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "run-test"}
          onClick={() => setActiveTab("run-test")}
        >
          Run &amp; Test
        </button>
      </div>
      {activeTab === "compose" ? (
        <SystemBuilderWorkspace workspaceId={workspaceId} client={client} />
      ) : null}
      {activeTab === "plans" ? (
        <AssetPlansTab
          workspaceId={workspaceId}
          client={createDesktopAssetCompositionClient()}
          projectionClient={createDesktopEffectiveAssetProjectionsClient()}
        />
      ) : null}
      {activeTab === "build-release" ? (
        <SystemBuildReleaseWorkflow
          workspaceId={workspaceId}
          systemBuilderClient={client}
          buildClient={buildClient}
          defaultDeploymentProfile="local-desktop"
        />
      ) : null}
      {activeTab === "run-test" ? (
        <div className="ui-stack ui-stack--md">
          <ConversationRunTestTab workspaceId={workspaceId} />
          <SystemDataRunTest
            workspaceId={workspaceId}
            client={dataClient}
            buildClient={buildClient}
          />
          <SystemReviewRunTest
            workspaceId={workspaceId}
            client={reviewClient}
            buildClient={buildClient}
          />
          <SystemDeploymentWorkflow
            workspaceId={workspaceId}
            buildClient={buildClient}
            deploymentClient={deploymentClient}
            deploymentProfiles={["local-desktop"]}
          />
        </div>
      ) : null}
    </section>
  );
}
