import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes contract adherence", () => {
  it("keeps route modules implemented as non-placeholder files", () => {
    const sources = [
      readSource("ui/routes/AppRouter.tsx"),
      readSource("ui/routes/ProtectedRoute.tsx"),
      readSource("ui/routes/RouteConfig.ts"),
    ];

    expect(sources.every((source) => source.trim().length > 0)).toBeTrue();
  });

  it("ensures canonical path contract is consistent", () => {
    const source = readSource("ui/routes/RouteConfig.ts");

    expect(source).toContain('home: "/"');
    expect(source).toContain('login: "/auth/login"');
    expect(source).toContain('register: "/auth/register"');
    expect(source).toContain('build: "/build"');
    expect(source).toContain('buildAutomate: "/build/automate"');
    expect(source).toContain('explore: "/explore"');
    expect(source).toContain('run: "/run"');
    expect(source).toContain('workflowConversation: "/run/workflow-chat/:sessionId"');
    expect(source).toContain('workflows: "/workflows"');
    expect(source).toContain('models: "/models"');
    expect(source).toContain('mcp: "/mcp"');
    expect(source).toContain('services: "/services"');
    expect(source).toContain('assets: "/assets"');
    expect(source).toContain('registry: "/studio-shell/registry"');
    expect(source).toContain('registryAssetDetail: "/studio-shell/registry/assets/:assetId"');
    expect(source).toContain('workflowStudioMode: "/studio-shell/workflow/:modeId"');
    expect(source).toContain('workflowStudioWizardPage: "/studio-shell/workflow/wizard/:wizardPageId"');
    expect(source).toContain('systemStudio: "/studio-shell/system"');
    expect(source).toContain('schemaStudio: "/studio-shell/schema"');
    expect(source).toContain('settings: "/settings"');
    expect(source).toContain('adminShell: "/settings/admin"');
    expect(source).toContain('adminLiteShell: "/settings/admin-lite"');
    expect(source).toContain('authorizationSharing: "/settings/sharing"');
    expect(source).toContain('authorizationSharingThin: "/settings/sharing/thin"');
    expect(source).toContain('authorizationReporting: "/settings/sharing/reporting"');
    expect(source).toContain('storageAdmin: "/settings/storage"');
    expect(source).toContain('workspaceAdmin: "/settings/workspaces"');
    expect(source).toContain('nodeEnrollmentReview: "/settings/node-enrollments"');
    expect(source).toContain('nodeInventory: "/settings/node-inventory"');
    expect(source).toContain('identityAdmin: "/settings/identity-admin"');
    expect(source).toContain('secretsAdmin: "/settings/secrets"');
    expect(source).toContain('notFound: "*"');
  });
});
