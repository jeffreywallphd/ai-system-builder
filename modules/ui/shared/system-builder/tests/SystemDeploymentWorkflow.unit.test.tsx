import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "../../../../testing/node-test";
import type { SystemDeploymentClient } from "../SystemDeploymentWorkflow";
import { SystemDeploymentWorkflow } from "../SystemDeploymentWorkflow";

describe("SystemDeploymentWorkflow", () => {
  it("renders one accessible lifecycle surface and tells thin clients that execution remains server-owned", () => {
    const pending = new Promise<never>(() => undefined);
    const deploymentClient: SystemDeploymentClient = {
      install: () => pending,
      activate: () => pending,
      health: () => pending,
      rollback: () => pending,
      revoke: () => pending,
      read: () => pending,
      list: () => pending,
      startRun: () => pending,
      cancelRun: () => pending,
      listRuns: () => pending,
      listAudit: () => pending,
    };
    const html = renderToStaticMarkup(
      <SystemDeploymentWorkflow
        workspaceId="workspace-a"
        buildClient={{ listReleases: () => pending }}
        deploymentClient={deploymentClient}
        deploymentProfiles={["campus-server", "cloud-server"]}
        controlSurfaceOnly
      />,
    );
    expect(html).toContain('aria-labelledby="system-deployment-title"');
    expect(html).toContain("Deploy and run");
    expect(html).toContain("Approved release");
    expect(html).toContain("Install release");
    expect(html).toContain("control surface only");
    expect(html).toContain(
      "privileged execution remain on the authenticated server",
    );
    expect(html).toContain("No deployments");
  });

  it("keeps deployment history and audit separators free of replacement characters", () => {
    const source = readFileSync(
      resolve("modules/ui/shared/system-builder/SystemDeploymentWorkflow.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/(?:\uFFFD|\u00ef\u00bf\u00bd)/u);
    expect(source.match(/\\u00b7/g)?.length).toBe(2);
  });
});
