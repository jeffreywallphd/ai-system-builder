import { type IdentityAuthApiResponse } from "../../../../api/identity/sdk/PublicIdentityAuthApiContract";
import { isSessionAssuranceAllowed, type SessionAssuranceLevel } from "./session-authentication";

export type SessionAssuranceRequirement =
  | "allow-untrusted"
  | "allow-pairing"
  | "require-trusted";

export interface SessionAssuranceRequirementResolution {
  readonly requirement: SessionAssuranceRequirement;
  readonly minimumAssuranceLevel: SessionAssuranceLevel;
}

export interface SessionAssuranceEnforcementFailure {
  readonly statusCode: 403;
  readonly body: IdentityAuthApiResponse<never>;
  readonly requestLogPayload: Readonly<Record<string, unknown>>;
}

export type SessionAssuranceEnforcementResult =
  | {
    readonly ok: true;
  }
  | {
    readonly ok: false;
    readonly failure: SessionAssuranceEnforcementFailure;
  };

export function resolveSessionAssuranceRequirement(
  requirement: SessionAssuranceRequirement | undefined,
): SessionAssuranceRequirementResolution | undefined {
  if (!requirement) {
    return undefined;
  }

  switch (requirement) {
    case "allow-untrusted":
      return Object.freeze({
        requirement,
        minimumAssuranceLevel: "authenticated-untrusted" as const,
      });
    case "allow-pairing":
      return Object.freeze({
        requirement,
        minimumAssuranceLevel: "authenticated-restricted" as const,
      });
    case "require-trusted":
      return Object.freeze({
        requirement,
        minimumAssuranceLevel: "authenticated-trusted" as const,
      });
    default:
      return undefined;
  }
}

export function enforceTrustedSessionAssurance(input: {
  readonly sessionAssuranceLevel: SessionAssuranceLevel;
  readonly requirement: SessionAssuranceRequirement | undefined;
  readonly buildForbiddenResponse(message: string): IdentityAuthApiResponse<never>;
  readonly failureMessage?: string;
}): SessionAssuranceEnforcementResult {
  const resolvedRequirement = resolveSessionAssuranceRequirement(input.requirement);
  if (!resolvedRequirement) {
    return Object.freeze({
      ok: true as const,
    });
  }

  if (isSessionAssuranceAllowed(input.sessionAssuranceLevel, resolvedRequirement.minimumAssuranceLevel)) {
    return Object.freeze({
      ok: true as const,
    });
  }

  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({
      statusCode: 403 as const,
      body: input.buildForbiddenResponse(input.failureMessage ?? "Session trust level is insufficient for this route."),
      requestLogPayload: Object.freeze({
        sessionAssuranceLevel: input.sessionAssuranceLevel,
        sessionAssuranceRequirement: resolvedRequirement.requirement,
        minimumAssuranceLevel: resolvedRequirement.minimumAssuranceLevel,
      }),
    }),
  });
}
