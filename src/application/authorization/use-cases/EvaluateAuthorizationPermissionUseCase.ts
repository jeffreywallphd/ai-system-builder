import { AuthorizationPolicyEvaluationTargetKinds, type AuthorizationPolicyDecisionEvaluationResult } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { parseAuthorizationPolicyEvaluationRequestDto } from "@shared/schemas/authorization/AuthorizationSchemaContracts";
import {
  AuthorizationAdministrationErrorCodes,
  type AuthorizationAdministrationOutcome,
  mapAuthorizationSchemaValidationError,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";

export interface EvaluateAuthorizationPermissionUseCaseInput {
  readonly request: unknown;
  readonly includeDebugDetails?: boolean;
}

interface EvaluateAuthorizationPermissionUseCaseDependencies {
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
}

export class EvaluateAuthorizationPermissionUseCase {
  public constructor(private readonly dependencies: EvaluateAuthorizationPermissionUseCaseDependencies) {}

  public async execute(
    input: EvaluateAuthorizationPermissionUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<AuthorizationPolicyDecisionEvaluationResult>> {
    let parsed: ReturnType<typeof parseAuthorizationPolicyEvaluationRequestDto>;
    try {
      parsed = parseAuthorizationPolicyEvaluationRequestDto(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization evaluation request is invalid.");
    }

    const result = await this.dependencies.decisionEvaluator.evaluateDecision({
      actor: parsed.actor,
      requiredPermissionKey: parsed.requiredPermissionKey,
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: parsed.resource,
      },
      asOf: parsed.asOf,
      includeDebugDetails: input.includeDebugDetails,
    });

    return {
      ok: true,
      value: result,
    };
  }
}

