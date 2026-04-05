import { z } from "zod";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  SharingPolicyModes,
  SharingSubjectKinds,
} from "../../../domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
} from "../../../domain/authorization/AuthorizationPermissionCatalog";
import {
  WorkspaceAuthorizationRoleKeys,
} from "../../../domain/authorization/AuthorizationRoleDefinitions";

export interface AuthorizationSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class AuthorizationSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<AuthorizationSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<AuthorizationSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "AuthorizationSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const AuthorizationIdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;
const PermissionKeyPattern = /^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/;

export const AuthorizationIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(AuthorizationIdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

export const AuthorizationTimestampSchema = z
  .string()
  .trim()
  .min(1, "Timestamp is required.")
  .datetime({ offset: true });

export const AuthorizationPermissionKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Permission key is required.")
  .regex(PermissionKeyPattern, "Permission key must be namespaced, for example 'asset.read'.");

const AuthorizationResourceFamilySchema = z.enum([
  AuthorizationResourceFamilies.asset,
  AuthorizationResourceFamilies.system,
  AuthorizationResourceFamilies.workflow,
  AuthorizationResourceFamilies.template,
  AuthorizationResourceFamilies.run,
  AuthorizationResourceFamilies.queue,
  AuthorizationResourceFamilies.log,
  AuthorizationResourceFamilies.storageInstance,
  AuthorizationResourceFamilies.secretMetadata,
  AuthorizationResourceFamilies.artifact,
]);

const WorkspaceAuthorizationRoleKeySchema = z.enum([
  WorkspaceAuthorizationRoleKeys.owner,
  WorkspaceAuthorizationRoleKeys.admin,
  WorkspaceAuthorizationRoleKeys.member,
  WorkspaceAuthorizationRoleKeys.viewer,
]);

const ManageableWorkspaceAuthorizationRoleKeySchema = z.enum([
  WorkspaceAuthorizationRoleKeys.admin,
  WorkspaceAuthorizationRoleKeys.member,
  WorkspaceAuthorizationRoleKeys.viewer,
]);

const ResourceVisibilitySchema = z.enum([
  ResourceVisibilities.private,
  ResourceVisibilities.workspace,
  ResourceVisibilities.shared,
  ResourceVisibilities.published,
]);

const SharingPolicyModeSchema = z.enum([
  SharingPolicyModes.ownerOnly,
  SharingPolicyModes.workspaceMembers,
  SharingPolicyModes.explicit,
  SharingPolicyModes.published,
]);

const AuthorizationResourceReferenceSchema = z.object({
  resourceFamily: AuthorizationResourceFamilySchema,
  resourceType: AuthorizationIdentifierSchema,
  resourceId: AuthorizationIdentifierSchema,
});

const AuthorizationActorReferenceSchema = z
  .object({
    actorUserIdentityId: AuthorizationIdentifierSchema.optional(),
    actorServiceId: AuthorizationIdentifierSchema.optional(),
    activeWorkspaceId: AuthorizationIdentifierSchema.optional(),
    authenticatedAt: AuthorizationTimestampSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.actorUserIdentityId && !value.actorServiceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actorUserIdentityId"],
        message: "actorUserIdentityId or actorServiceId is required.",
      });
    }
  });

export const AuthorizationPolicyEvaluationRequestDtoSchema = z.object({
  actor: AuthorizationActorReferenceSchema,
  resource: AuthorizationResourceReferenceSchema,
  requiredPermissionKey: AuthorizationPermissionKeySchema,
  asOf: AuthorizationTimestampSchema.optional(),
  correlationId: AuthorizationIdentifierSchema.optional(),
});

const AuthorizationSharingTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(SharingSubjectKinds.user),
    userId: AuthorizationIdentifierSchema,
  }),
  z.object({
    kind: z.literal(SharingSubjectKinds.workspaceRole),
    workspaceId: AuthorizationIdentifierSchema,
    roleKey: WorkspaceAuthorizationRoleKeySchema,
  }),
  z.object({
    kind: z.literal(SharingSubjectKinds.workspace),
    workspaceId: AuthorizationIdentifierSchema,
  }),
  z.object({
    kind: z.literal(SharingSubjectKinds.public),
  }),
]);

const AuthorizationSharingGrantSchema = z.object({
  id: AuthorizationIdentifierSchema,
  target: AuthorizationSharingTargetSchema,
  permissionKeys: z.array(AuthorizationPermissionKeySchema).min(1, "Sharing grants require at least one permission key."),
});

const AuthorizationSharingGrantChangeBaseSchema = z.object({
  actorUserIdentityId: AuthorizationIdentifierSchema,
  resource: AuthorizationResourceReferenceSchema,
  workspaceId: AuthorizationIdentifierSchema.optional(),
  visibility: ResourceVisibilitySchema,
});

const AuthorizationSharingGrantUpsertRequestSchema = AuthorizationSharingGrantChangeBaseSchema.extend({
  operation: z.literal("upsert"),
  grant: AuthorizationSharingGrantSchema,
});

const AuthorizationSharingGrantRevokeRequestSchema = AuthorizationSharingGrantChangeBaseSchema.extend({
  operation: z.literal("revoke"),
  grantId: AuthorizationIdentifierSchema,
});

export const AuthorizationSharingGrantChangeRequestSchema = z
  .discriminatedUnion("operation", [
    AuthorizationSharingGrantUpsertRequestSchema,
    AuthorizationSharingGrantRevokeRequestSchema,
  ])
  .superRefine((value, context) => {
    if (value.operation !== "upsert") {
      return;
    }

    if (
      value.visibility === ResourceVisibilities.private
      || value.visibility === ResourceVisibilities.workspace
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visibility"],
        message: "Explicit sharing grant changes require shared or published visibility.",
      });
    }

    const target = value.grant.target;
    if (
      target.kind === SharingSubjectKinds.workspace
      || target.kind === SharingSubjectKinds.workspaceRole
    ) {
      if (!value.workspaceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workspaceId"],
          message: "workspaceId is required for workspace or workspace-role sharing targets.",
        });
      } else if (target.workspaceId !== value.workspaceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["grant", "target", "workspaceId"],
          message: "Workspace-oriented sharing targets must match request workspaceId.",
        });
      }
    }

    if (target.kind === SharingSubjectKinds.public && value.visibility !== ResourceVisibilities.published) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grant", "target", "kind"],
        message: "Public sharing targets require published visibility.",
      });
    }
  });

export const AuthorizationVisibilityUpdateRequestSchema = z
  .object({
    actorUserIdentityId: AuthorizationIdentifierSchema,
    subject: AuthorizationResourceReferenceSchema,
    workspaceId: AuthorizationIdentifierSchema.optional(),
    visibility: ResourceVisibilitySchema,
    sharingPolicyMode: SharingPolicyModeSchema,
    allowResharing: z.boolean().default(false),
    sharingGrants: z.array(AuthorizationSharingGrantSchema).default([]),
    isPublishedCapable: z.boolean().default(false),
    publishedAt: AuthorizationTimestampSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.visibility === ResourceVisibilities.private) {
      if (value.sharingPolicyMode !== SharingPolicyModes.ownerOnly) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingPolicyMode"],
          message: "Private visibility requires sharingPolicyMode 'owner-only'.",
        });
      }
      if (value.sharingGrants.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingGrants"],
          message: "Private visibility cannot include sharing grants.",
        });
      }
    }

    if (value.visibility === ResourceVisibilities.workspace) {
      if (!value.workspaceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workspaceId"],
          message: "Workspace visibility requires workspaceId.",
        });
      }
      if (value.sharingPolicyMode !== SharingPolicyModes.workspaceMembers) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingPolicyMode"],
          message: "Workspace visibility requires sharingPolicyMode 'workspace-members'.",
        });
      }
      if (value.sharingGrants.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingGrants"],
          message: "Workspace visibility cannot include sharing grants.",
        });
      }
    }

    if (value.visibility === ResourceVisibilities.shared) {
      if (!value.workspaceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workspaceId"],
          message: "Shared visibility requires workspaceId.",
        });
      }
      if (value.sharingPolicyMode !== SharingPolicyModes.explicit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingPolicyMode"],
          message: "Shared visibility requires sharingPolicyMode 'explicit'.",
        });
      }
      if (value.sharingGrants.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingGrants"],
          message: "Shared visibility requires at least one sharing grant.",
        });
      }
    }

    if (value.visibility === ResourceVisibilities.published) {
      if (!value.workspaceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workspaceId"],
          message: "Published visibility requires workspaceId.",
        });
      }
      if (value.sharingPolicyMode !== SharingPolicyModes.published) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingPolicyMode"],
          message: "Published visibility requires sharingPolicyMode 'published'.",
        });
      }
      if (!value.isPublishedCapable) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["isPublishedCapable"],
          message: "Published visibility requires isPublishedCapable=true.",
        });
      }
      if (!value.publishedAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["publishedAt"],
          message: "Published visibility requires publishedAt.",
        });
      }
    }

    if (value.visibility !== ResourceVisibilities.published && value.publishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishedAt"],
        message: "Only published visibility may include publishedAt.",
      });
    }

    for (const [index, grant] of value.sharingGrants.entries()) {
      if (
        (grant.target.kind === SharingSubjectKinds.workspace || grant.target.kind === SharingSubjectKinds.workspaceRole)
        && !value.workspaceId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workspaceId"],
          message: "workspaceId is required for workspace-oriented sharing targets.",
        });
      }

      if (
        value.workspaceId
        && (grant.target.kind === SharingSubjectKinds.workspace || grant.target.kind === SharingSubjectKinds.workspaceRole)
        && grant.target.workspaceId !== value.workspaceId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingGrants", index, "target", "workspaceId"],
          message: "Workspace-oriented sharing targets must match visibility request workspaceId.",
        });
      }

      if (grant.target.kind === SharingSubjectKinds.public && value.visibility !== ResourceVisibilities.published) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sharingGrants", index, "target", "kind"],
          message: "Public sharing targets require published visibility.",
        });
      }
    }
  });

export const AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema = z
  .object({
    actorUserIdentityId: AuthorizationIdentifierSchema,
    workspaceId: AuthorizationIdentifierSchema,
    roleKey: WorkspaceAuthorizationRoleKeySchema,
    resources: z.array(AuthorizationResourceReferenceSchema)
      .min(1, "At least one target resource is required.")
      .max(250, "Bulk sharing grants support up to 250 resources per request."),
    permissionKeys: z.array(AuthorizationPermissionKeySchema)
      .min(1, "At least one permission key is required.")
      .max(32, "Bulk sharing grants support up to 32 permission keys per request."),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, resource] of value.resources.entries()) {
      const lookupKey = `${resource.resourceFamily}:${resource.resourceType}:${resource.resourceId}`;
      if (seen.has(lookupKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resources", index],
          message: "Duplicate resources are not allowed in bulk sharing grant requests.",
        });
      } else {
        seen.add(lookupKey);
      }
    }
  });

const AuthorizationRoleAssignmentRequestBaseSchema = z.object({
  workspaceId: AuthorizationIdentifierSchema,
  actorUserIdentityId: AuthorizationIdentifierSchema,
  targetUserIdentityId: AuthorizationIdentifierSchema,
});

const AuthorizationAssignRoleRequestSchema = AuthorizationRoleAssignmentRequestBaseSchema.extend({
  operation: z.literal("assign"),
  roleKey: ManageableWorkspaceAuthorizationRoleKeySchema,
});

const AuthorizationReassignRoleRequestSchema = AuthorizationRoleAssignmentRequestBaseSchema.extend({
  operation: z.literal("reassign"),
  fromRoleKey: ManageableWorkspaceAuthorizationRoleKeySchema,
  toRoleKey: ManageableWorkspaceAuthorizationRoleKeySchema,
}).superRefine((value, context) => {
  if (value.fromRoleKey === value.toRoleKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toRoleKey"],
      message: "Role reassignment requires different fromRoleKey and toRoleKey values.",
    });
  }
});

const AuthorizationRevokeRoleRequestSchema = AuthorizationRoleAssignmentRequestBaseSchema.extend({
  operation: z.literal("revoke"),
  roleKey: ManageableWorkspaceAuthorizationRoleKeySchema,
});

export const AuthorizationRoleAssignmentRequestSchema = z.discriminatedUnion("operation", [
  AuthorizationAssignRoleRequestSchema,
  AuthorizationReassignRoleRequestSchema,
  AuthorizationRevokeRoleRequestSchema,
]);

export const AuthorizationResourcePolicyMetadataSchema = z
  .object({
    resourceFamily: AuthorizationResourceFamilySchema,
    resourceType: AuthorizationIdentifierSchema,
    resourceId: AuthorizationIdentifierSchema,
    ownerUserIdentityId: AuthorizationIdentifierSchema,
    ownershipScope: z.enum([ResourceOwnershipScopes.userPrivate, ResourceOwnershipScopes.workspace]),
    workspaceId: AuthorizationIdentifierSchema.optional(),
    visibility: ResourceVisibilitySchema,
    sharingPolicyMode: SharingPolicyModeSchema,
    allowResharing: z.boolean(),
    isPublishedCapable: z.boolean(),
    publishedAt: AuthorizationTimestampSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.ownershipScope === ResourceOwnershipScopes.userPrivate && value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "User-private ownership cannot include workspaceId.",
      });
    }

    if (value.ownershipScope === ResourceOwnershipScopes.workspace && !value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "Workspace ownership requires workspaceId.",
      });
    }

    if (value.visibility === ResourceVisibilities.workspace && value.ownershipScope !== ResourceOwnershipScopes.workspace) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ownershipScope"],
        message: "Workspace visibility requires workspace ownership scope.",
      });
    }

    if (value.visibility === ResourceVisibilities.private && value.sharingPolicyMode !== SharingPolicyModes.ownerOnly) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sharingPolicyMode"],
        message: "Private visibility requires sharingPolicyMode 'owner-only'.",
      });
    }

    if (value.visibility === ResourceVisibilities.workspace && value.sharingPolicyMode !== SharingPolicyModes.workspaceMembers) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sharingPolicyMode"],
        message: "Workspace visibility requires sharingPolicyMode 'workspace-members'.",
      });
    }

    if (value.visibility === ResourceVisibilities.shared && value.sharingPolicyMode !== SharingPolicyModes.explicit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sharingPolicyMode"],
        message: "Shared visibility requires sharingPolicyMode 'explicit'.",
      });
    }

    if (value.visibility === ResourceVisibilities.published && value.sharingPolicyMode !== SharingPolicyModes.published) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sharingPolicyMode"],
        message: "Published visibility requires sharingPolicyMode 'published'.",
      });
    }

    if (value.visibility === ResourceVisibilities.published && !value.isPublishedCapable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isPublishedCapable"],
        message: "Published visibility requires isPublishedCapable=true.",
      });
    }

    if (value.visibility === ResourceVisibilities.published && !value.publishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishedAt"],
        message: "Published visibility requires publishedAt.",
      });
    }

    if (value.visibility !== ResourceVisibilities.published && value.publishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishedAt"],
        message: "Only published visibility may include publishedAt.",
      });
    }
  });

export type AuthorizationPolicyEvaluationRequestDtoPayload = z.infer<typeof AuthorizationPolicyEvaluationRequestDtoSchema>;
export type AuthorizationSharingGrantChangeRequest = z.infer<typeof AuthorizationSharingGrantChangeRequestSchema>;
export type AuthorizationVisibilityUpdateRequest = z.infer<typeof AuthorizationVisibilityUpdateRequestSchema>;
export type AuthorizationBulkWorkspaceRoleSharingGrantRequest = z.infer<typeof AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema>;
export type AuthorizationRoleAssignmentRequest = z.infer<typeof AuthorizationRoleAssignmentRequestSchema>;
export type AuthorizationResourcePolicyMetadataPayload = z.infer<typeof AuthorizationResourcePolicyMetadataSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): AuthorizationSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new AuthorizationSchemaValidationError(schemaName, issues);
}

function parseAuthorizationSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }

  return parsed.data;
}

export function parseAuthorizationPolicyEvaluationRequestDto(
  payload: unknown,
): AuthorizationPolicyEvaluationRequestDtoPayload {
  return parseAuthorizationSchema(
    "AuthorizationPolicyEvaluationRequestDto",
    AuthorizationPolicyEvaluationRequestDtoSchema,
    payload,
  );
}

export function parseAuthorizationSharingGrantChangeRequest(
  payload: unknown,
): AuthorizationSharingGrantChangeRequest {
  return parseAuthorizationSchema(
    "AuthorizationSharingGrantChangeRequest",
    AuthorizationSharingGrantChangeRequestSchema,
    payload,
  );
}

export function parseAuthorizationVisibilityUpdateRequest(
  payload: unknown,
): AuthorizationVisibilityUpdateRequest {
  return parseAuthorizationSchema(
    "AuthorizationVisibilityUpdateRequest",
    AuthorizationVisibilityUpdateRequestSchema,
    payload,
  );
}

export function parseAuthorizationBulkWorkspaceRoleSharingGrantRequest(
  payload: unknown,
): AuthorizationBulkWorkspaceRoleSharingGrantRequest {
  return parseAuthorizationSchema(
    "AuthorizationBulkWorkspaceRoleSharingGrantRequest",
    AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema,
    payload,
  );
}

export function parseAuthorizationRoleAssignmentRequest(
  payload: unknown,
): AuthorizationRoleAssignmentRequest {
  return parseAuthorizationSchema(
    "AuthorizationRoleAssignmentRequest",
    AuthorizationRoleAssignmentRequestSchema,
    payload,
  );
}

export function parseAuthorizationResourcePolicyMetadata(
  payload: unknown,
): AuthorizationResourcePolicyMetadataPayload {
  return parseAuthorizationSchema(
    "AuthorizationResourcePolicyMetadata",
    AuthorizationResourcePolicyMetadataSchema,
    payload,
  );
}
