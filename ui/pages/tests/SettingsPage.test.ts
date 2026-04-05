import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("SettingsPage", () => {
  it("organizes user-configurable settings into related sections", () => {
    const source = readSource("ui/pages/SettingsPage.tsx");

    expect(source).toContain('title="Workspace Data"');
    expect(source).toContain('title="Models & Downloads"');
    expect(source).toContain('title="Runtime & Integrations"');
    expect(source).toContain('title="Workflow Authoring"');
    expect(source).toContain('title="Development Tools"');
  });

  it("includes workspace mode controls and contextual advanced areas", () => {
    const source = readSource("ui/pages/SettingsPage.tsx");

    expect(source).toContain("Auto-save is enabled");
    expect(source).toContain('id="settings-development-workspace-mode"');
    expect(source).toContain("settingsStore.setWorkspaceDataMode");
    expect(source).toContain("Development (dev/workflow-data)");
    expect(source).toContain("Production (user/workflow-data)");
    expect(source).toContain("Advanced runtime settings");
    expect(source).toContain('id="settings-runtime-python-version"');
    expect(source).toContain("Python 3.12 (default)");
    expect(source).toContain("Python 3.11");
    expect(source).toContain("repair or recreate the runtime environment");
    expect(source).toContain("<McpRuntimeStatusPanel");
    expect(source).toContain("mcpStore.subscribe(setMcpState)");
    expect(source).toContain("servers={mcpState.configuredServers}");
    expect(source).toContain("isLoading={mcpState.isLoadingConfigured || mcpState.isSearching || mcpState.isMutating}");
    expect(source).toContain("onSearchChange={(value) => void mcpStore.search({ query: value }).catch(() => undefined)}");
    expect(source).toContain("Authentication & install defaults");
    expect(source).toContain("Advanced development settings");
    expect(source).toContain("Workspace administration");
    expect(source).toContain("to={ROUTE_PATHS.workspaceAdmin}");
    expect(source).toContain("Node enrollment review");
    expect(source).toContain("to={ROUTE_PATHS.nodeEnrollmentReview}");
    expect(source).toContain("Authorization reporting");
    expect(source).toContain("to={ROUTE_PATHS.authorizationReporting}");
    expect(source).toContain("Workspace memberships");
    expect(source).toContain("to={ROUTE_PATHS.workspaceThinMembership}");
    expect(source).toContain('id="settings-authoring-default-view-mode"');
    expect(source).toContain("function NumberField");
  });

  it("uses folder picker dialogs for directory-based settings", () => {
    const source = readSource("ui/pages/SettingsPage.tsx");

    expect(source).toContain("function FolderPathField");
    expect(source).toContain("showDirectoryPicker");
    expect(source).toContain('node?.setAttribute("webkitdirectory", "")');
    expect(source).toContain('node?.setAttribute("multiple", "")');
    expect(source).toContain("firstFile.path");
    expect(source).toContain("Folder names alone are not saved.");
    expect(source).not.toContain("return normalizeDirectoryPath(candidate.name)");
    expect(source).toContain("Browse…");
  });
});
