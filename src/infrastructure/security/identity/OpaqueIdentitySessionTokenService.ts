import { createHash, randomBytes } from "node:crypto";
import type {
  IdentitySessionTokenIssueResult,
  IIdentitySessionTokenService,
} from "../../../application/identity/ports/IIdentitySessionTokenService";

const TOKEN_PREFIX = "loom_sess";
const TOKEN_BYTES = 32;

export class OpaqueIdentitySessionTokenService implements IIdentitySessionTokenService {
  public issueToken(): IdentitySessionTokenIssueResult {
    const tokenValue = randomBytes(TOKEN_BYTES).toString("base64url");
    const token = `${TOKEN_PREFIX}_${tokenValue}`;

    return Object.freeze({
      token,
      tokenHash: this.hashToken(token),
      hashAlgorithm: "sha256",
      tokenType: "opaque-bearer",
    });
  }

  public hashToken(token: string): string {
    return createHash("sha256")
      .update(token, "utf8")
      .digest("base64url");
  }
}
