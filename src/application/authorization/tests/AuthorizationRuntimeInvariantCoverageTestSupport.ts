import {
  InvariantTargetKinds,
  type InvariantEvaluationRequest,
  type InvariantFamilyAdapter,
  type InvariantFeatureFamily,
  type InvariantObservedResult,
} from "@testing/invariants";
import type { AuthorizationInvariantRuntimeFixture } from "@testing/invariants/composedRuntimeFixtures";

export interface AuthorizationRuntimeGrantRequestInput {
  readonly sessionToken: string;
  readonly resourceFamily: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
  readonly grant: {
    readonly id: string;
    readonly target: {
      readonly kind: "user";
      readonly userId: string;
    };
    readonly permissionKeys: ReadonlyArray<string>;
  };
}

export interface AuthorizationRuntimeAccessStateRequestInput {
  readonly sessionToken: string;
  readonly resourceFamily: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly inspectedActorUserIdentityId: string;
  readonly requiredPermissionKey: string;
  readonly includeDenied?: boolean;
}

export interface AuthorizationRuntimeWorkspaceReportRequestInput {
  readonly sessionToken: string;
  readonly workspaceId: string;
  readonly asOf?: string;
}

const RUNTIME_FIXTURE_KEY = "authorizationRuntimeFixture";

function resolveRuntimeFixture(fixtures: Readonly<Record<string, unknown>>): AuthorizationInvariantRuntimeFixture {
  const fixture = fixtures[RUNTIME_FIXTURE_KEY];
  if (!fixture) {
    throw new Error(`Invariant fixture '${RUNTIME_FIXTURE_KEY}' is required for runtime authorization evaluation.`);
  }
  return fixture as AuthorizationInvariantRuntimeFixture;
}

export class AuthorizationRuntimeGrantInvariantAdapter
  implements InvariantFamilyAdapter<AuthorizationRuntimeGrantRequestInput> {
  public constructor(public readonly family: InvariantFeatureFamily) {}

  public async evaluate(
    request: InvariantEvaluationRequest<AuthorizationRuntimeGrantRequestInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' is missing runtime authorization input.`);
    }

    const fixture = resolveRuntimeFixture(request.fixtures);
    const endpoint = `${fixture.baseUrl}/api/v1/authorization/resources/${encodeURIComponent(input.resourceFamily)}/${encodeURIComponent(input.resourceType)}/${encodeURIComponent(input.resourceId)}/sharing-grants`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.sessionToken}`,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        grant: input.grant,
      }),
    });

    const payload = await response.json() as {
      readonly ok?: boolean;
      readonly error?: {
        readonly code?: string;
      };
    };

    const responseCode = String(response.status);
    const outcome = response.ok ? "allow" : "deny";

    return Object.freeze({
      outcome,
      decision: Object.freeze({
        reasonCode: response.ok ? "transport-accepted" : "transport-denied",
        denialReason: response.ok ? undefined : payload.error?.code,
        sourceKind: "composed-runtime-route-family",
        targetKind: request.scenario.target.targetKind ?? InvariantTargetKinds.resource,
        requiredPermissionKey: input.grant.permissionKeys[0],
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: request.scenario.workspace.workspaceId,
          resourceFamily: request.scenario.target.resourceFamily,
          resourceType: request.scenario.target.resourceType,
          resourceId: request.scenario.target.resourceId,
        }),
        provenance: Object.freeze({
          routeFamilyId: fixture.participants.routeFamily.routeFamilyId,
          transport: fixture.participants.routeFamily.transport,
          backendApi: fixture.participants.routeFamily.backendApi,
          evaluator: fixture.participants.evaluator.policyDecisionEvaluator,
          policyReadRepository: fixture.participants.repositories.policyReadRepository,
          persistenceAdapter: fixture.participants.adapters.authorizationPersistence,
        }),
      }),
      runtime: Object.freeze({
        statusCode: responseCode,
      }),
    });
  }
}

export class AuthorizationRuntimeAccessStateInvariantAdapter
  implements InvariantFamilyAdapter<AuthorizationRuntimeAccessStateRequestInput> {
  public constructor(public readonly family: InvariantFeatureFamily) {}

  public async evaluate(
    request: InvariantEvaluationRequest<AuthorizationRuntimeAccessStateRequestInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' is missing runtime authorization input.`);
    }

    const fixture = resolveRuntimeFixture(request.fixtures);
    const query = new URLSearchParams({
      inspectedActorUserIdentityId: input.inspectedActorUserIdentityId,
      includeDenied: String(input.includeDenied ?? true),
    });
    const endpoint = `${fixture.baseUrl}/api/v1/authorization/resources/${encodeURIComponent(input.resourceFamily)}/${encodeURIComponent(input.resourceType)}/${encodeURIComponent(input.resourceId)}/access-state?${query.toString()}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.sessionToken}`,
      },
    });

    if (!response.ok) {
      const deniedPayload = await response.json() as {
        readonly error?: {
          readonly code?: string;
        };
      };

      return Object.freeze({
        outcome: "deny",
        decision: Object.freeze({
          reasonCode: "transport-denied",
          denialReason: deniedPayload.error?.code,
          sourceKind: "composed-runtime-route-family",
          targetKind: request.scenario.target.targetKind ?? InvariantTargetKinds.resource,
          requiredPermissionKey: input.requiredPermissionKey,
          scope: Object.freeze({
            isApplicable: true,
            scopeKind: "workspace",
            workspaceId: request.scenario.workspace.workspaceId,
            resourceFamily: request.scenario.target.resourceFamily,
            resourceType: request.scenario.target.resourceType,
            resourceId: request.scenario.target.resourceId,
          }),
          provenance: Object.freeze({
            routeFamilyId: fixture.participants.routeFamily.routeFamilyId,
            transport: fixture.participants.routeFamily.transport,
            backendApi: fixture.participants.routeFamily.backendApi,
          }),
        }),
        runtime: Object.freeze({
          statusCode: String(response.status),
        }),
      });
    }

    const payload = await response.json() as {
      readonly data?: {
        readonly permissions?: ReadonlyArray<{
          readonly permissionKey: string;
          readonly isAllowed: boolean;
          readonly reasonCode?: string;
          readonly denialReason?: string;
        }>;
      };
    };
    const permissionEntry = payload.data?.permissions?.find((entry) => entry.permissionKey === input.requiredPermissionKey);
    const isAllowed = permissionEntry?.isAllowed === true;

    return Object.freeze({
      outcome: isAllowed ? "allow" : "deny",
      decision: Object.freeze({
        reasonCode: permissionEntry?.reasonCode ?? "permission-entry-missing",
        denialReason: isAllowed ? undefined : permissionEntry?.denialReason ?? "insufficient-permissions",
        sourceKind: "composed-runtime-route-family",
        targetKind: request.scenario.target.targetKind ?? InvariantTargetKinds.resource,
        requiredPermissionKey: input.requiredPermissionKey,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace",
          workspaceId: request.scenario.workspace.workspaceId,
          resourceFamily: request.scenario.target.resourceFamily,
          resourceType: request.scenario.target.resourceType,
          resourceId: request.scenario.target.resourceId,
        }),
        provenance: Object.freeze({
          routeFamilyId: fixture.participants.routeFamily.routeFamilyId,
          transport: fixture.participants.routeFamily.transport,
          backendApi: fixture.participants.routeFamily.backendApi,
        }),
      }),
      runtime: Object.freeze({
        statusCode: String(response.status),
      }),
    });
  }
}

export class AuthorizationRuntimeWorkspaceReportInvariantAdapter
  implements InvariantFamilyAdapter<AuthorizationRuntimeWorkspaceReportRequestInput> {
  public constructor(public readonly family: InvariantFeatureFamily) {}

  public async evaluate(
    request: InvariantEvaluationRequest<AuthorizationRuntimeWorkspaceReportRequestInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' is missing runtime authorization input.`);
    }

    const fixture = resolveRuntimeFixture(request.fixtures);
    const query = new URLSearchParams();
    if (input.asOf) {
      query.set("asOf", input.asOf);
    }
    const querySuffix = query.size > 0 ? `?${query.toString()}` : "";
    const endpoint = `${fixture.baseUrl}/api/v1/authorization/reporting/workspaces/${encodeURIComponent(input.workspaceId)}${querySuffix}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.sessionToken}`,
      },
    });

    let denialReason: string | undefined;
    if (!response.ok) {
      const payload = await response.json() as {
        readonly error?: {
          readonly code?: string;
        };
      };
      denialReason = payload.error?.code;
    }

    return Object.freeze({
      outcome: response.ok ? "allow" : "deny",
      decision: Object.freeze({
        reasonCode: response.ok ? "transport-accepted" : "transport-denied",
        denialReason,
        sourceKind: "composed-runtime-route-family",
        targetKind: request.scenario.target.targetKind ?? InvariantTargetKinds.capability,
        requiredPermissionKey: request.scenario.capability,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind: "workspace-capability",
          workspaceId: input.workspaceId,
          resourceFamily: request.scenario.target.resourceFamily,
          resourceType: request.scenario.target.resourceType,
          resourceId: request.scenario.target.resourceId,
        }),
        provenance: Object.freeze({
          routeFamilyId: fixture.participants.routeFamily.routeFamilyId,
          transport: fixture.participants.routeFamily.transport,
          backendApi: fixture.participants.routeFamily.backendApi,
        }),
      }),
      runtime: Object.freeze({
        statusCode: String(response.status),
      }),
    });
  }
}

export function buildRuntimeInvariantFixtureBag(
  fixture: AuthorizationInvariantRuntimeFixture,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    [RUNTIME_FIXTURE_KEY]: fixture,
  });
}
