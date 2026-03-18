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
    expect(source).toContain('workflows: "/workflows"');
    expect(source).toContain('models: "/models"');
    expect(source).toContain('assets: "/assets"');
    expect(source).toContain('settings: "/settings"');
    expect(source).toContain('notFound: "*"');
  });
});
