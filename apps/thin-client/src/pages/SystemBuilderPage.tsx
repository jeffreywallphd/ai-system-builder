import { useMemo, useState } from "react";
import {
  SystemBuilderWorkspace,
  SystemBuildReleaseWorkflow,
  SystemDataRunTest,
  SystemReviewRunTest,
  SystemDeploymentWorkflow,
} from "../../../../modules/ui/shared/system-builder";
import { AssetPlansTab } from "../features/asset-composition/components/AssetPlansTab";
import { createThinClientAssetCompositionClient } from "../features/asset-composition/api/thinClientAssetCompositionClient";
import { createThinClientEffectiveAssetProjectionsClient } from "../features/effective-asset-projections/api/thinClientEffectiveAssetProjectionsClient";
import { ConversationRunTestTab } from "../features/conversations/components/ConversationRunTestTab";
import { createThinClientSystemBuilderClient } from "../features/system-builder/api/thinClientSystemBuilderClient";
import { createThinClientSystemBuildClient } from "../features/system-builder/api/thinClientSystemBuildClient";

import { createThinClientSystemDataClient } from "../features/system-builder/api/thinClientSystemDataClient";
import { createThinClientSystemReviewClient } from "../features/system-builder/api/thinClientSystemReviewClient";
import { createThinClientSystemDeploymentClient } from "../features/system-builder/api/thinClientSystemDeploymentClient";
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
  const client = useMemo(() => createThinClientSystemBuilderClient(), []);
  const buildClient = useMemo(() => createThinClientSystemBuildClient(), []);
  const dataClient = useMemo(() => createThinClientSystemDataClient(), []);
  const reviewClient = useMemo(() => createThinClientSystemReviewClient(), []);
  const deploymentClient = useMemo(
    () => createThinClientSystemDeploymentClient(),
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
          client={createThinClientAssetCompositionClient()}
          projectionClient={createThinClientEffectiveAssetProjectionsClient()}
        />
      ) : null}
      {activeTab === "build-release" ? (
        <SystemBuildReleaseWorkflow
          workspaceId={workspaceId}
          systemBuilderClient={client}
          buildClient={buildClient}
          defaultDeploymentProfile="thin-client"
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
            deploymentProfiles={["campus-server", "cloud-server"]}
            controlSurfaceOnly
          />
        </div>
      ) : null}
    </section>
  );
}
