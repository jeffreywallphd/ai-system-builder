import { describe, expect, it } from "bun:test";
import { OpaqueIdentitySessionTokenService } from "../OpaqueIdentitySessionTokenService";

describe("OpaqueIdentitySessionTokenService", () => {
  it("issues opaque bearer tokens and deterministic hashes", () => {
    const service = new OpaqueIdentitySessionTokenService();

    const issued = service.issueToken();
    expect(issued.token.startsWith("loom_sess_")).toBeTrue();
    expect(issued.tokenType).toBe("opaque-bearer");
    expect(issued.hashAlgorithm).toBe("sha256");
    expect(issued.tokenHash).toBe(service.hashToken(issued.token));

    const next = service.issueToken();
    expect(next.token).not.toBe(issued.token);
    expect(next.tokenHash).not.toBe(issued.tokenHash);
  });
});
