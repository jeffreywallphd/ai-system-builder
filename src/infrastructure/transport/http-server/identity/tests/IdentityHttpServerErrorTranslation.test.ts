import { describe, expect, it } from "bun:test";
import {
  mapIdentityAuthApiStatusCode,
  mapStorageManagementApiStatusCode,
  mapSystemRuntimeApiStatusCode,
  mapWorkspaceAdministrationApiStatusCode,
  mapSharedApiErrorCodeToStatusCode,
  mapToSharedApiErrorCode,
  normalizeSharedApiErrorEnvelope,
  translateTransportError,
} from "../IdentityHttpServerErrorTranslation";

describe("IdentityHttpServerErrorTranslation", () => {
  it("maps known domain codes to shared codes and status codes", () => {
    expect(mapToSharedApiErrorCode("invalid-request")).toBe("invalid-request");
    expect(mapToSharedApiErrorCode("authentication-failed")).toBe("authentication-failed");
    expect(mapToSharedApiErrorCode("permission-denied")).toBe("forbidden");
    expect(mapToSharedApiErrorCode("not-found")).toBe("not-found");
    expect(mapToSharedApiErrorCode("conflict")).toBe("conflict");
    expect(mapToSharedApiErrorCode("rate-limited")).toBe("rate-limited");
    expect(mapToSharedApiErrorCode("transient-failure")).toBe("temporarily-unavailable");
    expect(mapSharedApiErrorCodeToStatusCode("temporarily-unavailable")).toBe(503);
  });

  it("maps route-family-specific transport errors through centralized status overrides", () => {
    expect(mapIdentityAuthApiStatusCode({ ok: false, error: { code: "unsupported-provider" } })).toBe(422);
    expect(mapIdentityAuthApiStatusCode({ ok: false, error: { code: "account-inactive" } })).toBe(403);
    expect(mapWorkspaceAdministrationApiStatusCode({ ok: false, error: { code: "invalid-transition" } })).toBe(422);
    expect(mapStorageManagementApiStatusCode({ ok: false, error: { code: "provisioning-failed" } })).toBe(409);
    expect(mapStorageManagementApiStatusCode({ ok: false, error: { code: "capability-unsupported" } })).toBe(422);
  });

  it("uses shared fallback mapping for unknown route-family errors", () => {
    expect(mapIdentityAuthApiStatusCode({ ok: false, error: { code: "transient-failure" } })).toBe(503);
    expect(mapStorageManagementApiStatusCode({ ok: false, error: { code: "rate-limited" } })).toBe(429);
  });

  it("preserves system-runtime default fallback semantics for unknown errors", () => {
    expect(mapSystemRuntimeApiStatusCode({ ok: false, error: { code: "quota-exceeded" } })).toBe(429);
    expect(mapSystemRuntimeApiStatusCode({ ok: false, error: { code: "transient-failure" } })).toBe(500);
  });

  it("returns transport translation metadata for correlation-safe diagnostics", () => {
    const translated = translateTransportError(
      { ok: false, error: { code: "temporarily-unavailable" } },
      {},
    );

    expect(translated.statusCode).toBe(503);
    expect(translated.sharedCode).toBe("temporarily-unavailable");
    expect(translated.domainCode).toBe("temporarily-unavailable");
    expect(translated.retryable).toBeTrue();
  });

  it("preserves safe messages and enriches client-visible error metadata", () => {
    const payload = normalizeSharedApiErrorEnvelope({
      ok: false,
      error: {
        code: "authentication-failed",
        message: "Session token is invalid or expired.",
      },
    }) as {
      readonly error: {
        readonly code: string;
        readonly sharedCode: string;
        readonly domainCode: string;
        readonly userMessage: string;
        readonly retryable: boolean;
        readonly message: string;
      };
    };

    expect(payload.error.code).toBe("authentication-failed");
    expect(payload.error.sharedCode).toBe("authentication-failed");
    expect(payload.error.domainCode).toBe("authentication-failed");
    expect(payload.error.retryable).toBeFalse();
    expect(payload.error.userMessage.length).toBeGreaterThan(0);
    expect(payload.error.message).toBe("Session token is invalid or expired.");
  });

  it("sanitizes sensitive messages to avoid leaking internals", () => {
    const payload = normalizeSharedApiErrorEnvelope({
      ok: false,
      error: {
        code: "internal",
        message: "sqlite failure while reading C:\\private\\secrets\\vault.db token",
      },
    }) as {
      readonly error: {
        readonly sharedCode: string;
        readonly userMessage: string;
        readonly message: string;
      };
    };

    expect(payload.error.sharedCode).toBe("internal");
    expect(payload.error.message).toBe(payload.error.userMessage);
    expect(payload.error.message.toLowerCase()).not.toContain("sqlite");
    expect(payload.error.message.toLowerCase()).not.toContain("secrets");
    expect(payload.error.message).toContain("internal server error");
  });
});
