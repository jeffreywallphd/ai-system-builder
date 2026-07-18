import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "../../../../testing/node-test";
import type { SystemBuildClient } from "../SystemBuildReleaseWorkflow";
import type { SystemBuilderClient } from "../SystemBuilderWorkspace";
import { SystemBuildReleaseWorkflow } from "../SystemBuildReleaseWorkflow";

describe("SystemBuildReleaseWorkflow", () => {
  it("renders one accessible shared workflow for selecting, building, reviewing, and approving", () => {
    const pending = new Promise<never>(() => undefined);
    const systemBuilderClient = {
      list: () => pending,
      listRevisions: () => pending,
    } satisfies Pick<SystemBuilderClient, "list" | "listRevisions">;
    const buildClient: SystemBuildClient = {
      request: () => pending,
      cancel: () => pending,
      listBuilds: () => pending,
      approve: () => pending,
      listReleases: () => pending,
      compare: () => pending,
    };

    const html = renderToStaticMarkup(
      <SystemBuildReleaseWorkflow workspaceId="workspace-a" systemBuilderClient={systemBuilderClient} buildClient={buildClient} />,
    );

    expect(html).toContain("Build and release");
    expect(html).toContain('aria-label="System build and release workflow"');
    expect(html).toContain("Choose an immutable revision");
    expect(html).toContain("Set the build environment");
    expect(html).toContain("Review build evidence");
    expect(html).toContain("Approve and compare releases");
    expect(html).toContain("Campus or corporate server");
    expect(html).toContain("Approve immutable release");
  });
});
