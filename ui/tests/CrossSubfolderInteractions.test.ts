import { describe, expect, it } from "bun:test";
import { readSource } from "./testUtils";

describe("ui cross-subfolder interactions", () => {
  it("keeps route/page/service/state/presenter surfaces synchronized as placeholders", () => {
    const modules = [
      "ui/routes/AppRouter.tsx",
      "ui/routes/ProtectedRoute.tsx",
      "ui/routes/RouteConfig.ts",
      "ui/pages/AssetsPage.tsx",
      "ui/pages/ModelsPage.tsx",
      "ui/pages/WorkflowEditorPage.tsx",
      "ui/services/ModelService.ts",
      "ui/services/NodeService.ts",
      "ui/services/WorkflowService.ts",
      "ui/state/ModelStore.ts",
      "ui/state/NodeStore.ts",
      "ui/state/WorkflowStore.ts",
      "ui/presenters/AssetPresenter.ts",
      "ui/presenters/ModelPresenter.ts",
      "ui/presenters/WorkflowPresenter.ts",
    ];

    expect(modules.every((modulePath) => readSource(modulePath).trim() === "")).toBeTrue();
  });
});
