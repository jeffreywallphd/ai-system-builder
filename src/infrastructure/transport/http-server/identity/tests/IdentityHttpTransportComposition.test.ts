import { describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import {
  AuthoritativeApiRouteBackendKeys,
  type AuthoritativeApiRouteRegistrationPlan,
} from "../../AuthoritativeApiRouteRegistration";
import { composeAuthoritativeApiRouteRegistrationPlan } from "../../AuthoritativeApiRouteRegistrationCatalog";
import { composeIdentityHttpTransport } from "../composition/IdentityHttpTransportComposition";
import {
  type IdentityHttpRouteFamilyModule,
  IdentityHttpRouteModuleRegistryError,
} from "../composition/RouteModuleRegistry";

function composeRoutePlan(overrides: Partial<Record<keyof typeof AuthoritativeApiRouteBackendKeys, boolean>>): AuthoritativeApiRouteRegistrationPlan {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: false,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
      [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
      [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
      [AuthoritativeApiRouteBackendKeys.auditLedger]: false,
      [AuthoritativeApiRouteBackendKeys.nodeTrust]: false,
      [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: false,
      [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
      [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
      [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
      [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: false,
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: false,
      [AuthoritativeApiRouteBackendKeys.runRead]: false,
      [AuthoritativeApiRouteBackendKeys.runMutation]: false,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: false,
      ...overrides,
    }),
  });
}

describe("IdentityHttpTransportComposition", () => {
  it("composes a deterministic route module registry from a route registration plan", () => {
    const routePlan = composeRoutePlan({
      identityAuth: true,
      workspaceInvitation: true,
      workspaceAdministration: true,
      runSubmission: true,
      runRead: true,
      runMutation: true,
    });

    const composition = composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      serverFactory: (requestListener) => createServer(requestListener),
    });

    const routeFamilyIds = composition.routeModuleRegistry.routeFamilies.map((family) => family.routeFamilyId);
    expect(routeFamilyIds).toEqual([
      "identity-auth",
      "workspace-invitations",
      "workspace-administration",
      "run-submission",
      "run-read",
      "run-mutation",
      "image-run-api",
    ]);
    expect(
      composition.routeModuleRegistry.resolveRouteFamilyByPath("/api/v1/workspaces/invitations/invite-123")
        ?.routeFamilyId,
    ).toBe("workspace-invitations");
    expect(
      composition.routeModuleRegistry.resolveRouteFamilyByPath("/api/v1/image-runs/run-123")
        ?.routeFamilyId,
    ).toBe("image-run-api");
    expect(
      composition.routeModuleRegistry.resolveRouteFamilyByPath("/api/v1/runtime/runs/start")
        ?.routeFamilyId,
    ).toBe("run-submission");
  });

  it("fails composition when a planned route family does not have a module implementation", () => {
    const routePlan = composeRoutePlan({
      identityAuth: true,
      workspaceInvitation: true,
    });
    const partialRouteFamilyModules: ReadonlyArray<IdentityHttpRouteFamilyModule> = Object.freeze([
      Object.freeze({
        routeFamily: routePlan.registeredRouteFamilies.find((family) => family.routeFamilyId === "identity-auth")!,
        register(registrar) {
          registrar.registerRoutePrefix("/api/v1/identity");
        },
      }),
    ]);

    expect(() => composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      routeFamilyModules: partialRouteFamilyModules,
      serverFactory: (requestListener) => createServer(requestListener),
    })).toThrow(IdentityHttpRouteModuleRegistryError);
  });
});
