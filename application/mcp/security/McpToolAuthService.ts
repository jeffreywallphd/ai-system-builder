import type {
  IMcpToolSecretRepository,
  McpToolSecretScope,
  ResolvedMcpToolSecretRecord,
} from "../../ports/interfaces/IMcpToolSecretRepository";
import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import type { McpToolCredentialStatus } from "../../../domain/mcp/McpToolTrust";
import type {
  McpCredentialResolutionContext,
  McpCredentialResolutionResult,
  McpCredentialValidationIssue,
} from "./McpCredentialResolution";

export interface ResolvedMcpToolCredentialBundle {
  readonly toolId: string;
  readonly values: Readonly<Record<string, string>>;
}

export class McpToolAuthService {
  constructor(private readonly secretRepository: IMcpToolSecretRepository) {}

  public async getCredentialStatus(
    tool: InstalledMcpToolRecord,
    context?: McpCredentialResolutionContext,
  ): Promise<McpToolCredentialStatus> {
    const resolution = await this.resolveCredentials(tool, context);
    const requiresAuth = tool.definition.auth.kind === "required";
    const configured = resolution.configured || resolution.status === "success" || resolution.status === "partial" || resolution.status === "invalid";
    const missingRequiredFields = requiresAuth
      ? resolution.issues.filter((issue) => issue.classification === "missing").map((issue) => issue.fieldKey)
      : [];

    return Object.freeze({
      toolId: tool.toolId,
      required: requiresAuth,
      configured,
      missingRequiredFields: Object.freeze([...new Set(missingRequiredFields)]),
      updatedAt: resolution.updatedAt,
    });
  }

  public async resolveCredentials(
    tool: InstalledMcpToolRecord,
    context?: McpCredentialResolutionContext,
  ): Promise<McpCredentialResolutionResult> {
    const requiredFields = tool.definition.auth.credentialFields ?? [];
    const requiresAuth = tool.definition.auth.kind === "required";
    const scopes = buildResolutionScopes(context);
    let resolved: ResolvedMcpToolSecretRecord | undefined;
    let selectedScope: McpToolSecretScope = scopes[scopes.length - 1];

    for (const scope of scopes) {
      const next = await this.secretRepository.resolveSecret(tool.toolId, scope);
      if (next) {
        resolved = next;
        selectedScope = scope;
        break;
      }
    }

    if (!resolved) {
      return Object.freeze({
        status: requiresAuth ? "missing" : "success",
        toolId: tool.toolId,
        scope: selectedScope,
        configured: false,
        values: Object.freeze({}),
        missingRequiredFields: Object.freeze(requiredFields.filter((field) => field.required).map((field) => field.key)),
        malformedFields: Object.freeze([]),
        issues: Object.freeze(requiredFields.filter((field) => field.required).map((field) => Object.freeze({
          fieldKey: field.key,
          classification: "missing" as const,
          reason: "Credential is required but not configured.",
        }))),
      });
    }

    const issues = validateCredentialFields(requiredFields, resolved.values);
    const missingRequiredFields = issues
      .filter((issue) => issue.classification === "missing")
      .map((issue) => issue.fieldKey);
    const malformedFields = issues
      .filter((issue) => issue.classification === "malformed")
      .map((issue) => issue.fieldKey);
    const hasMissing = missingRequiredFields.length > 0;
    const hasMalformed = malformedFields.length > 0;
    const status = hasMalformed
      ? "invalid"
      : hasMissing
        ? "partial"
        : "success";

    return Object.freeze({
      status: requiresAuth ? status : "success",
      toolId: tool.toolId,
      scope: selectedScope,
      configured: true,
      values: Object.freeze({ ...resolved.values }),
      missingRequiredFields: Object.freeze([...new Set(missingRequiredFields)]),
      malformedFields: Object.freeze([...new Set(malformedFields)]),
      issues: Object.freeze(issues),
      updatedAt: resolved.updatedAt,
    });
  }

  public async resolveRequiredCredentials(
    tool: InstalledMcpToolRecord,
    context?: McpCredentialResolutionContext,
  ): Promise<ResolvedMcpToolCredentialBundle | undefined> {
    if (tool.definition.auth.kind !== "required" && tool.definition.auth.kind !== "optional") {
      return undefined;
    }
    const resolution = await this.resolveCredentials(tool, context);
    if (!resolution.configured || resolution.status === "missing") {
      return undefined;
    }
    if (tool.definition.auth.kind === "required" && resolution.status !== "success") {
      return undefined;
    }

    return Object.freeze({
      toolId: tool.toolId,
      values: Object.freeze({ ...resolution.values }),
    });
  }
}

function buildResolutionScopes(context?: McpCredentialResolutionContext): ReadonlyArray<McpToolSecretScope> {
  const scopes: McpToolSecretScope[] = [];
  if (context?.projectId?.trim()) {
    scopes.push(Object.freeze({ scopeType: "project", scopeId: context.projectId.trim() }));
  }
  if (context?.userId?.trim()) {
    scopes.push(Object.freeze({ scopeType: "user", scopeId: context.userId.trim() }));
  }
  scopes.push(Object.freeze({ scopeType: "global" }));
  return Object.freeze(scopes);
}

function validateCredentialFields(
  fields: ReadonlyArray<{ readonly key: string; readonly required: boolean; readonly format?: "string" | "token" | "password" }>,
  values: Readonly<Record<string, string>>,
): ReadonlyArray<McpCredentialValidationIssue> {
  const issues: McpCredentialValidationIssue[] = [];
  for (const field of fields) {
    const rawValue = values[field.key];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) {
      if (field.required) {
        issues.push(Object.freeze({
          fieldKey: field.key,
          classification: "missing",
          reason: "Credential is required but missing.",
        }));
      }
      continue;
    }
    if ((field.format === "token" || field.format === "password") && /\s/.test(value)) {
      issues.push(Object.freeze({
        fieldKey: field.key,
        classification: "malformed",
        reason: "Credential contains whitespace and does not match expected token/password format.",
      }));
    }
  }
  return Object.freeze(issues);
}
