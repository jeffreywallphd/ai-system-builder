export interface IdentitySessionTokenIssueResult {
  readonly token: string;
  readonly tokenHash: string;
  readonly hashAlgorithm: "sha256";
  readonly tokenType: "opaque-bearer";
}

export interface IIdentitySessionTokenService {
  issueToken(): IdentitySessionTokenIssueResult;
  hashToken(token: string): string;
}
