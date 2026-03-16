import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../tests/testUtils";

describe("ui/routes unit coverage", () => {
  it("AppRouter.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/routes/AppRouter.tsx"));
  it("ProtectedRoute.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/routes/ProtectedRoute.tsx"));
  it("RouteConfig.ts is currently a placeholder module", () => expectPlaceholderModule("ui/routes/RouteConfig.ts"));
});
