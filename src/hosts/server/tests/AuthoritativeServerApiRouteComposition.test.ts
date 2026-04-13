import { describe, expect, it } from "bun:test";
import {
  composeAuthoritativeServerApiRouteRegistrationPlan,
  composeDesktopAuthoritativeServerApiRouteRegistrationPlan,
} from "../AuthoritativeServerApiRouteComposition";

describe("AuthoritativeServerApiRouteComposition", () => {
  it("keeps system runtime route family out of the default server registration plan", () => {
    const plan = composeAuthoritativeServerApiRouteRegistrationPlan();
    const routeFamilyIds = plan.registeredRouteFamilies.map((family) => family.routeFamilyId);

    expect(routeFamilyIds).not.toContain("system-runtime");
  });

  it("can include system runtime route family when runtime families are explicitly requested", () => {
    const plan = composeAuthoritativeServerApiRouteRegistrationPlan({
      includeRuntimeRouteFamilies: true,
    });
    const routeFamilyIds = plan.registeredRouteFamilies.map((family) => family.routeFamilyId);

    expect(routeFamilyIds).toContain("system-runtime");
  });

  it("exposes a desktop-specific composition helper that enables runtime route families", () => {
    const desktopPlan = composeDesktopAuthoritativeServerApiRouteRegistrationPlan();
    const desktopRouteFamilyIds = desktopPlan.registeredRouteFamilies.map((family) => family.routeFamilyId);

    expect(desktopRouteFamilyIds).toContain("system-runtime");
  });
});
