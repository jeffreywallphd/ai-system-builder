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

function composeAllBackendsRoutePlan(): AuthoritativeApiRouteRegistrationPlan {
  return composeRoutePlan({
    identityAuth: true,
    workspaceInvitation: true,
    workspaceAdministration: true,
    authorizationManagement: true,
    auditLedger: true,
    nodeTrust: true,
    executionNodeManagement: true,
    certificateOperations: true,
    secretMetadata: true,
    storageManagement: true,
    assetManagement: true,
    imageAssetManagement: true,
    deploymentPolicyRead: true,
    deploymentPolicyWrite: true,
    systemRuntime: true,
    runSubmission: true,
    runRead: true,
    runMutation: true,
    runExecutionUpdate: true,
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
      composition.routeModuleRegistry.resolveRouteFamilyByPath("/api/v1/workspaces/workspace-alpha/invitations")
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

  it("keeps route registration snapshots deterministic across repeated compositions", () => {
    const routePlan = composeAllBackendsRoutePlan();
    const snapshots = Array.from({ length: 4 }).map(() => composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      serverFactory: (requestListener) => createServer(requestListener),
    }).routeModuleRegistry.toSnapshot());

    const canonical = snapshots[0]!;
    for (const snapshot of snapshots.slice(1)) {
      expect(snapshot).toEqual(canonical);
    }

    expect(canonical.routeFamilies.length).toBeGreaterThanOrEqual(18);
    expect(canonical.routePrefixes.length).toBeGreaterThanOrEqual(canonical.routeFamilies.length);
  });

  it("keeps modular route-family dispatch lookup overhead within cutover budget", () => {
    const routePlan = composeAllBackendsRoutePlan();
    const composition = composeIdentityHttpTransport({
      routeRegistrationPlan: routePlan,
      serverFactory: (requestListener) => createServer(requestListener),
    });
    const lookupPaths = Object.freeze([
      "/api/v1/identity/login",
      "/api/v1/workspaces/invitations",
      "/api/v1/workspaces/workspace-alpha/members",
      "/api/v1/authorization/reporting/workspaces/workspace-alpha",
      "/api/v1/deployment/policy/state",
      "/api/v1/audit/events",
      "/api/v1/execution-nodes",
      "/api/v1/security/certificates",
      "/api/v1/security/secrets",
      "/api/v1/storage/instances",
      "/api/v1/assets",
      "/api/v1/image-assets",
      "/api/v1/runtime/runs/start",
      "/api/v1/runtime/runs",
      "/api/v1/runtime/runs/run%3A1/cancel",
      "/api/v1/runtime/runs/run%3A1/lifecycle",
      "/api/v1/runtime/queue",
      "/api/v1/image-runs/run%3A1/generated-results",
      "/api/v1/unmatched/path",
    ]);
    const iterations = 20_000;
    let warmupMatches = 0;
    for (let i = 0; i < 2_000; i += 1) {
      for (const path of lookupPaths) {
        if (composition.routeModuleRegistry.resolveRouteFamilyByPath(path)) {
          warmupMatches += 1;
        }
      }
    }
    expect(warmupMatches).toBeGreaterThan(0);

    const startedAt = performance.now();
    let totalMatches = 0;
    for (let i = 0; i < iterations; i += 1) {
      for (const path of lookupPaths) {
        if (composition.routeModuleRegistry.resolveRouteFamilyByPath(path)) {
          totalMatches += 1;
        }
      }
    }
    const elapsedMs = performance.now() - startedAt;
    const lookups = iterations * lookupPaths.length;
    const averageLookupMicros = (elapsedMs * 1000) / lookups;

    expect(totalMatches).toBeGreaterThan(lookups / 2);
    expect(averageLookupMicros).toBeLessThan(40);
  });
});
