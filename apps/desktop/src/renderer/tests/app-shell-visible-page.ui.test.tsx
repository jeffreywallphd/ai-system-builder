require.extensions[".svg"] = (module: NodeModule) => {
  module.exports = "logo.svg";
};

import { renderToString } from "react-dom/server";

import { describe, expect, it, testDouble } from "../../../../../modules/testing/node-test";
import type { WorkspaceClient } from "../features/workspace";

function workspaceClient(): WorkspaceClient {
  return {
    listWorkspaces: testDouble.fn(async () => []),
    readActiveWorkspaceSelection: testDouble.fn(async () => ({})),
    saveActiveWorkspaceSelection: testDouble.fn(async () => undefined),
    clearActiveWorkspaceSelection: testDouble.fn(async () => undefined),
    createWorkspace: testDouble.fn(async () => {
      throw new Error("unused");
    }),
  };
}

describe("desktop AppShell visible workspace page state", () => {
  it("does not mark a pending workspace-required route active while setup is visible", async () => {
    const { ActiveWorkspaceProvider } = await import("../features/workspace");
    const { AppShell } = await import("../components/layout/AppShell");
    const { desktopPageDefinitions } = await import("../routes/desktopPages");
    const html = renderToString(
      <ActiveWorkspaceProvider client={workspaceClient()}>
        <AppShell activePage={undefined} pages={desktopPageDefinitions} onNavigate={() => undefined}>
          <section>Workspace required</section>
        </AppShell>
      </ActiveWorkspaceProvider>,
    );

    expect(html).toContain("Workspace required");
    expect(html).toContain("Models");
    expect(html).not.toContain('aria-current="page"');
  });
});
