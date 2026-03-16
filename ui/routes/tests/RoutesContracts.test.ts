import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/routes contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/routes/AppRouter.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/routes/ProtectedRoute.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/routes/RouteConfig.ts"))).toEqual([]);
  });
});
