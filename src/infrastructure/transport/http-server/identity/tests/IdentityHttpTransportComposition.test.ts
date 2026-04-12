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
import {
  IdentityAuthRouteFamilyModule,
  WorkspaceInvitationRouteFamilyModule,
  WorkspaceAdministrationRouteFamilyModule,
  RunSubmissionRouteFamilyModule,
  RunReadRouteFamilyModule,
  RunMutationRouteFamilyModule,
  ImageRunRouteFamilyModule,
} from "../route-families/AuthoritativeIdentityRouteFamilyModules";

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

  it("preserves registration-plan ordering when modules are provided in a different order", () => {
    const routePlan = composeRoutePlan({
      identityAuth: true,
      workspaceInvitation: true,
      workspaceAdministration: true,
      runSubmission: true,
      runRead: true,
      runMutation: true,
    });
    const shuffledModules = Object.freeze<ReadonlyArray<IdentityHttpRouteFamilyModule>>([
      RunMutationRouteFamilyModule,
      WorkspaceAdministrationRouteFamilyModule,
      IdentityAuthRouteFamilyModule,
      RunSubmissionRouteFamilyModule,
      ImageRunRouteFamilyModule,
      WorkspaceInvitationRouteFamilyModule,
      RunReadRouteFamilyModule,
    ]);

    const composition = composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      routeFamilyModules: shuffledModules,
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

  it("fails composition when the registration plan contains duplicate route family ids", () => {
    const routePlan = composeRoutePlan({
      identityAuth: true,
    });
    const duplicatedIdentityFamilyPlan: AuthoritativeApiRouteRegistrationPlan = Object.freeze({
      ...routePlan,
      registeredRouteFamilies: Object.freeze([
        routePlan.registeredRouteFamilies[0]!,
        routePlan.registeredRouteFamilies[0]!,
      ]),
    });

    expect(() => composeIdentityHttpTransport({
      routeRegistrationPlan: duplicatedIdentityFamilyPlan,
      serverFactory: (requestListener) => createServer(requestListener),
    })).toThrow("duplicate route family");
  });

  it("fails composition when multiple route families register the same route prefix", () => {
    const routePlan: AuthoritativeApiRouteRegistrationPlan = Object.freeze({
      backendAvailability: composeRoutePlan({}).backendAvailability,
      registeredRouteFamilies: Object.freeze([
        Object.freeze({
          routeFamilyId: "custom-family-a",
          domain: "identity",
          description: "Custom family A",
          routePrefixes: Object.freeze(["/api/v1/custom-prefix"]),
          requiredBackendKeys: Object.freeze([AuthoritativeApiRouteBackendKeys.identityAuth]),
        }),
        Object.freeze({
          routeFamilyId: "custom-family-b",
          domain: "identity",
          description: "Custom family B",
          routePrefixes: Object.freeze(["/api/v1/custom-prefix"]),
          requiredBackendKeys: Object.freeze([AuthoritativeApiRouteBackendKeys.workspaceInvitation]),
        }),
      ]),
      registeredRoutePrefixes: Object.freeze(["/api/v1/custom-prefix"]),
    });
    const conflictingModules: ReadonlyArray<IdentityHttpRouteFamilyModule> = Object.freeze([
      Object.freeze({
        routeFamily: routePlan.registeredRouteFamilies[0]!,
        register(registrar) {
          registrar.registerRoutePrefix("/api/v1/custom-prefix");
        },
      }),
      Object.freeze({
        routeFamily: routePlan.registeredRouteFamilies[1]!,
        register(registrar) {
          registrar.registerRoutePrefix("/api/v1/custom-prefix");
        },
      }),
    ]);

    expect(() => composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      routeFamilyModules: conflictingModules,
      serverFactory: (requestListener) => createServer(requestListener),
    })).toThrow("registered by both");
  });
});
