import { describe, expect, it } from "bun:test";
import { IdentityAuthApiErrorCodes, type IdentityAuthApiResponse } from "../../../../api/identity/sdk/PublicIdentityAuthApiContract";
import {
  enforceTrustedSessionAssurance,
  resolveSessionAssuranceRequirement,
} from "../middleware/trusted-session-assurance";

function buildForbiddenResponse(message: string): IdentityAuthApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: IdentityAuthApiErrorCodes.forbidden,
      message,
    }),
  });
}

describe("trusted-session assurance middleware", () => {
  it("allows requests when no assurance requirement is declared", () => {
    const result = enforceTrustedSessionAssurance({
      sessionAssuranceLevel: "authenticated-untrusted",
      requirement: undefined,
      buildForbiddenResponse,
    });

    expect(result).toEqual({
      ok: true,
    });
  });

  it("allows paired-or-trusted sessions for allow-pairing requirement", () => {
    const pairedResult = enforceTrustedSessionAssurance({
      sessionAssuranceLevel: "authenticated-restricted",
      requirement: "allow-pairing",
      buildForbiddenResponse,
    });
    const trustedResult = enforceTrustedSessionAssurance({
      sessionAssuranceLevel: "authenticated-trusted",
      requirement: "allow-pairing",
      buildForbiddenResponse,
    });

    expect(pairedResult).toEqual({
      ok: true,
    });
    expect(trustedResult).toEqual({
      ok: true,
    });
  });

  it("fails closed when a trusted requirement is not met", () => {
    const result = enforceTrustedSessionAssurance({
      sessionAssuranceLevel: "authenticated-restricted",
      requirement: "require-trusted",
      buildForbiddenResponse,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected trusted-session enforcement failure.");
    }

    expect(result.failure.statusCode).toBe(403);
    expect(result.failure.body).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "Session trust level is insufficient for this route.",
      },
    });
    expect(result.failure.requestLogPayload).toEqual({
      sessionAssuranceLevel: "authenticated-restricted",
      sessionAssuranceRequirement: "require-trusted",
      minimumAssuranceLevel: "authenticated-trusted",
    });
  });

  it("maps route assurance declarations to minimum assurance levels", () => {
    expect(resolveSessionAssuranceRequirement("allow-untrusted")).toEqual({
      requirement: "allow-untrusted",
      minimumAssuranceLevel: "authenticated-untrusted",
    });
    expect(resolveSessionAssuranceRequirement("allow-pairing")).toEqual({
      requirement: "allow-pairing",
      minimumAssuranceLevel: "authenticated-restricted",
    });
    expect(resolveSessionAssuranceRequirement("require-trusted")).toEqual({
      requirement: "require-trusted",
      minimumAssuranceLevel: "authenticated-trusted",
    });
  });
});
