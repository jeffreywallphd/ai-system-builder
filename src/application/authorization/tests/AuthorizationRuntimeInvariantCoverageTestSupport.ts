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
  readonly grant: {
    readonly id: string;
    readonly target: {
      readonly kind: "user";
      readonly userId: string;
    };
    readonly permissionKeys: ReadonlyArray<string>;
  };
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

export function buildRuntimeInvariantFixtureBag(
  fixture: AuthorizationInvariantRuntimeFixture,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    [RUNTIME_FIXTURE_KEY]: fixture,
  });
}
