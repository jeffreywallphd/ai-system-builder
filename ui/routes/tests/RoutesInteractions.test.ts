import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes interactions", () => {
  it("keeps placeholder modules consistent for AppRouter.tsx, ProtectedRoute.tsx, RouteConfig.ts", () => {
    const sources = [readSource("ui/routes/AppRouter.tsx"), readSource("ui/routes/ProtectedRoute.tsx"), readSource("ui/routes/RouteConfig.ts")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
