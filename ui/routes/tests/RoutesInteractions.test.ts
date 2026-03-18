import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes interactions", () => {
  it("connects AppRouter with RouteConfig and ProtectedRoute", () => {
    const appRouterSource = readSource("ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain('import ProtectedRoute from "./ProtectedRoute"');
    expect(appRouterSource).toContain('import { ROUTE_PATHS } from "./RouteConfig"');
    expect(appRouterSource).toContain("redirectTo={ROUTE_PATHS.home}");
  });

  it("keeps navigation and 404 route interactions intact", () => {
    const appRouterSource = readSource("ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain('element={<NotFoundPage />}');
    expect(appRouterSource).toContain('element={<Navigate to={ROUTE_PATHS.home} replace />}');
    expect(appRouterSource).toContain('element={<SettingsPage />}');
  });
});
