import { z } from "zod";

export interface WorkspaceTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class WorkspaceTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<WorkspaceTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<WorkspaceTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "WorkspaceTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });

const WorkspaceStatusSchema = z.enum(["provisioning", "active", "suspended", "archived"]);
const WorkspaceVisibilitySchema = z.enum(["private", "team", "public"]);
const WorkspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const ListWorkspacesRequestSchema = z.object({
  actorUserIdentityId: IdentifierSchema,
  ownerUserIdentityId: IdentifierSchema.optional(),
  statuses: z.array(WorkspaceStatusSchema).optional(),
  visibility: WorkspaceVisibilitySchema.optional(),
  slugPrefix: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const CreateWorkspaceRequestSchema = z.object({
  actorUserIdentityId: IdentifierSchema,
  slug: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1024).optional(),
  visibility: WorkspaceVisibilitySchema.optional(),
  status: WorkspaceStatusSchema.optional(),
}).strict();

export const WorkspaceAdministrationViewResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    workspace: z.object({
      workspaceId: IdentifierSchema,
      slug: z.string().trim().min(1),
      displayName: z.string().trim().min(1),
      description: z.string().trim().max(1024).optional(),
      status: WorkspaceStatusSchema,
      ownerUserIdentityId: IdentifierSchema,
      visibility: WorkspaceVisibilitySchema,
      createdAt: TimestampSchema,
      lastModifiedAt: TimestampSchema,
    }).strict(),
  }).strict().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).strict().optional(),
}).strict();

export const AssignWorkspaceRoleRequestSchema = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  targetUserIdentityId: IdentifierSchema,
  role: WorkspaceRoleSchema,
  reason: z.string().trim().max(512).optional(),
  correlationId: IdentifierSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type ListWorkspacesRequestPayload = z.infer<typeof ListWorkspacesRequestSchema>;
export type CreateWorkspaceRequestPayload = z.infer<typeof CreateWorkspaceRequestSchema>;
export type WorkspaceAdministrationViewResponsePayload = z.infer<typeof WorkspaceAdministrationViewResponseSchema>;
export type AssignWorkspaceRoleRequestPayload = z.infer<typeof AssignWorkspaceRoleRequestSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseWorkspaceSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new WorkspaceTransportSchemaValidationError(
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

export function parseListWorkspacesRequest(payload: unknown): ListWorkspacesRequestPayload {
  return parseWorkspaceSchema("ListWorkspacesRequest", ListWorkspacesRequestSchema, payload);
}

export function parseCreateWorkspaceRequest(payload: unknown): CreateWorkspaceRequestPayload {
  return parseWorkspaceSchema("CreateWorkspaceRequest", CreateWorkspaceRequestSchema, payload);
}

export function parseWorkspaceAdministrationViewResponse(payload: unknown): WorkspaceAdministrationViewResponsePayload {
  return parseWorkspaceSchema(
    "WorkspaceAdministrationViewResponse",
    WorkspaceAdministrationViewResponseSchema,
    payload,
  );
}

export function parseAssignWorkspaceRoleRequest(payload: unknown): AssignWorkspaceRoleRequestPayload {
  return parseWorkspaceSchema("AssignWorkspaceRoleRequest", AssignWorkspaceRoleRequestSchema, payload);
}
