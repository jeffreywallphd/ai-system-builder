import { describe, expect, it } from "bun:test";
import { doesPathMatchRoutePrefix } from "../primitives/RoutePrefixMatcher";

describe("RoutePrefixMatcher", () => {
  it("matches canonical static route prefixes", () => {
    expect(doesPathMatchRoutePrefix("/api/v1/identity/session", "/api/v1/identity")).toBeTrue();
    expect(doesPathMatchRoutePrefix("/api/v1/identity", "/api/v1/identity")).toBeTrue();
    expect(doesPathMatchRoutePrefix("/api/v1/identities", "/api/v1/identity")).toBeFalse();
  });

  it("matches placeholder-based route prefixes for workspace-scoped invitation flows", () => {
    expect(
      doesPathMatchRoutePrefix(
        "/api/v1/workspaces/workspace-alpha/invitations",
        "/api/v1/workspaces/{workspaceId}/invitations",
      ),
    ).toBeTrue();
    expect(
      doesPathMatchRoutePrefix(
        "/api/v1/workspaces/workspace-alpha/onboarding/accept",
        "/api/v1/workspaces/{workspaceId}/onboarding",
      ),
    ).toBeTrue();
    expect(
      doesPathMatchRoutePrefix(
        "/api/v1/workspaces/invitations",
        "/api/v1/workspaces/{workspaceId}/invitations",
      ),
    ).toBeFalse();
  });
});
