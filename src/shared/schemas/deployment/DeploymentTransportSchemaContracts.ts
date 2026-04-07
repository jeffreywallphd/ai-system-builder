import { z } from "zod";

export interface DeploymentTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class DeploymentTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<DeploymentTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<DeploymentTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "DeploymentTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });

export const DeploymentStartRequestSchema = z.object({
  requestId: IdentifierSchema,
  requestedAt: TimestampSchema,
  systemPackage: z.object({
    packageId: IdentifierSchema,
  }).passthrough(),
  target: z.object({
    targetId: IdentifierSchema,
    type: z.enum(["local", "cloud", "edge"]),
  }).passthrough(),
  deploymentConfiguration: z.object({
    configurationId: IdentifierSchema,
    packageId: IdentifierSchema,
    rootSystemAssetId: IdentifierSchema,
    rootSystemVersionId: IdentifierSchema,
    targetId: IdentifierSchema,
    targetType: z.enum(["local", "cloud", "edge"]),
  }).passthrough(),
}).strict();

export const DeploymentStatusRequestSchema = z.object({
  deploymentId: IdentifierSchema,
  tenantId: IdentifierSchema.optional(),
  stateTransitionLimit: z.number().int().min(1).max(1000).optional(),
}).strict();

export const DeploymentHealthResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    deploymentId: IdentifierSchema,
    status: z.enum(["healthy", "degraded", "unhealthy", "pending", "unknown"]),
    evaluatedAt: TimestampSchema,
    reasons: z.array(z.string()),
  }).passthrough().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).strict().optional(),
}).strict();

export type DeploymentStartRequestPayload = z.infer<typeof DeploymentStartRequestSchema>;
export type DeploymentStatusRequestPayload = z.infer<typeof DeploymentStatusRequestSchema>;
export type DeploymentHealthResponsePayload = z.infer<typeof DeploymentHealthResponseSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseDeploymentSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new DeploymentTransportSchemaValidationError(
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

export function parseDeploymentStartRequest(payload: unknown): DeploymentStartRequestPayload {
  return parseDeploymentSchema("DeploymentStartRequest", DeploymentStartRequestSchema, payload);
}

export function parseDeploymentStatusRequest(payload: unknown): DeploymentStatusRequestPayload {
  return parseDeploymentSchema("DeploymentStatusRequest", DeploymentStatusRequestSchema, payload);
}

export function parseDeploymentHealthResponse(payload: unknown): DeploymentHealthResponsePayload {
  return parseDeploymentSchema("DeploymentHealthResponse", DeploymentHealthResponseSchema, payload);
}
