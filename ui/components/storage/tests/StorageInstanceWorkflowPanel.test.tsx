import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StorageInstanceWorkflowPanel from "../StorageInstanceWorkflowPanel";
import type { StorageAdministrationService } from "../../../services/StorageAdministrationService";

describe("StorageInstanceWorkflowPanel", () => {
  it("renders create and edit workflow controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(StorageInstanceWorkflowPanel, {
        workspaceId: "workspace-1",
        onWorkspaceIdChange: () => undefined,
        actorUserIdentityId: "user-admin-1",
        sessionToken: "token-1",
        service: {} as StorageAdministrationService,
        selectedStorage: undefined,
        onMutationComplete: async () => undefined,
      }),
    );

    expect(html).toContain("Create and edit workflows");
    expect(html).toContain("Create storage");
    expect(html).toContain("Save selected metadata");
    expect(html).toContain("Policy labels (key=value per line)");
  });
});
