import { z } from "zod";

export interface IdentityTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class IdentityTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<IdentityTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<IdentityTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "IdentityTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });

export const RegisterLocalIdentityRequestSchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).optional(),
  providerId: IdentifierSchema.optional(),
  providerSubject: IdentifierSchema.optional(),
  credentialPolicyId: IdentifierSchema.optional(),
  credential: z.object({
    candidate: z.string().min(1),
  }).strict(),
}).strict();

export const LoginLocalIdentityRequestSchema = z.object({
  providerId: IdentifierSchema.optional(),
  providerSubject: IdentifierSchema,
  accessChannel: z.enum(["desktop", "thin-client"]).optional(),
  sessionTrustRequirement: z.enum(["allow-untrusted", "allow-pairing", "require-trusted"]).optional(),
  credential: z.object({
    candidate: z.string().min(1),
  }).strict(),
}).strict();

export const ResolveAuthenticatedSessionResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    principal: z.object({
      userIdentityId: IdentifierSchema,
      providerId: IdentifierSchema,
      providerSubject: IdentifierSchema,
      username: z.string().trim().min(1),
    }).strict(),
    session: z.object({
      sessionId: IdentifierSchema,
      issuedAt: TimestampSchema,
      expiresAt: TimestampSchema,
      accessChannel: z.enum(["desktop", "thin-client"]),
      sessionAssuranceLevel: z.enum([
        "authenticated-untrusted",
        "authenticated-restricted",
        "authenticated-trusted",
      ]),
    }).strict(),
  }).strict().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    validationErrors: z.array(z.object({
      path: z.string().trim().min(1),
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
    }).strict()).optional(),
  }).strict().optional(),
}).strict();

export const IdentityAdminListAccountsRequestSchema = z.object({
  actorUserIdentityId: IdentifierSchema,
  providerId: IdentifierSchema.optional(),
  includeStatuses: z.array(z.enum([
    "pending-activation",
    "active",
    "suspended",
    "locked",
    "deactivated",
  ])).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export type RegisterLocalIdentityRequestPayload = z.infer<typeof RegisterLocalIdentityRequestSchema>;
export type LoginLocalIdentityRequestPayload = z.infer<typeof LoginLocalIdentityRequestSchema>;
export type ResolveAuthenticatedSessionResponsePayload = z.infer<typeof ResolveAuthenticatedSessionResponseSchema>;
export type IdentityAdminListAccountsRequestPayload = z.infer<typeof IdentityAdminListAccountsRequestSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseIdentitySchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new IdentityTransportSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export function parseRegisterLocalIdentityRequest(payload: unknown): RegisterLocalIdentityRequestPayload {
  return parseIdentitySchema("RegisterLocalIdentityRequest", RegisterLocalIdentityRequestSchema, payload);
}

export function parseLoginLocalIdentityRequest(payload: unknown): LoginLocalIdentityRequestPayload {
  return parseIdentitySchema("LoginLocalIdentityRequest", LoginLocalIdentityRequestSchema, payload);
}

export function parseResolveAuthenticatedSessionResponse(payload: unknown): ResolveAuthenticatedSessionResponsePayload {
  return parseIdentitySchema(
    "ResolveAuthenticatedSessionResponse",
    ResolveAuthenticatedSessionResponseSchema,
    payload,
  );
}

export function parseIdentityAdminListAccountsRequest(payload: unknown): IdentityAdminListAccountsRequestPayload {
  return parseIdentitySchema("IdentityAdminListAccountsRequest", IdentityAdminListAccountsRequestSchema, payload);
}
