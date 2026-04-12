import { describe, expect, it } from "bun:test";
import {
  AuthMinimalServerForbiddenRouteFamilyIds,
  AuthMinimalServerRequiredRouteFamilyIds,
  assertAuthMinimalServerApiRouteRegistrationCoverage,
  composeAuthMinimalServerApiRouteRegistrationPlan,
} from "../AuthMinimalServerApiRouteComposition";
import {
  assertAuthoritativeServerApiRouteRegistrationCoverage,
  composeAuthoritativeServerApiRouteRegistrationPlan,
} from "../AuthoritativeServerApiRouteComposition";
import { AuthoritativeApiRouteRegistrationError } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog";

describe("AuthMinimalServerApiRouteComposition", () => {
  it("registers only identity-auth route family for pre-login startup", () => {
    const plan = composeAuthMinimalServerApiRouteRegistrationPlan();

    expect(AuthMinimalServerRequiredRouteFamilyIds).toEqual(["identity-auth"]);
    expect(plan.registeredRouteFamilies.map((family) => family.routeFamilyId)).toEqual(["identity-auth"]);
    expect(plan.registeredRoutePrefixes).toEqual(["/api/v1/identity"]);
  });

  it("asserts coverage against the narrowed auth-minimal family set", () => {
    const plan = composeAuthMinimalServerApiRouteRegistrationPlan();

    expect(() => assertAuthMinimalServerApiRouteRegistrationCoverage(plan)).not.toThrow();
    expect(() => assertAuthoritativeServerApiRouteRegistrationCoverage(plan))
      .toThrow(AuthoritativeApiRouteRegistrationError);
  });

  it("fails when non-auth route families are composed into auth-minimal startup", () => {
    const authoritativePlan = composeAuthoritativeServerApiRouteRegistrationPlan();

    expect(() => assertAuthMinimalServerApiRouteRegistrationCoverage(authoritativePlan))
      .toThrow("Auth-minimal startup route scope expanded unexpectedly");
    for (const forbiddenRouteFamilyId of AuthMinimalServerForbiddenRouteFamilyIds) {
      expect(authoritativePlan.registeredRouteFamilies.map((family) => family.routeFamilyId))
        .toContain(forbiddenRouteFamilyId);
    }
  });

  it("keeps full authoritative route coverage available for authoritative mode", () => {
    const plan = composeAuthoritativeServerApiRouteRegistrationPlan();

    expect(() => assertAuthoritativeServerApiRouteRegistrationCoverage(plan)).not.toThrow();
  });
});
