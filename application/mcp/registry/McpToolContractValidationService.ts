import type { McpToolDefinition } from "../../../domain/mcp/McpToolCapability";

export interface McpContractValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface McpContractValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<McpContractValidationIssue>;
}

export class McpToolContractValidationService {
  public validateInput(definition: McpToolDefinition, input: unknown): McpContractValidationResult {
    return this.validateAgainstSchema(definition.inputSchema, input, "input");
  }

  public validateOutput(definition: McpToolDefinition, output: unknown): McpContractValidationResult {
    if (!definition.outputSchema) {
      return Object.freeze({ valid: true, issues: Object.freeze([]) });
    }
    return this.validateAgainstSchema(definition.outputSchema, output, "output");
  }

  private validateAgainstSchema(
    schema: Readonly<Record<string, unknown>>,
    value: unknown,
    rootLabel: string,
  ): McpContractValidationResult {
    const issues: McpContractValidationIssue[] = [];
    const expectedType = typeof schema.type === "string" ? schema.type : "object";

    if (!isTypeMatch(expectedType, value)) {
      issues.push({ path: rootLabel, message: `Expected ${expectedType} value.` });
      return Object.freeze({ valid: false, issues: Object.freeze(issues) });
    }

    if (expectedType === "object" && value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const requiredFields = Array.isArray(schema.required)
        ? schema.required.filter((item): item is string => typeof item === "string")
        : [];

      for (const required of requiredFields) {
        if (!(required in record)) {
          issues.push({ path: `${rootLabel}.${required}`, message: "Missing required value." });
        }
      }

      const properties = schema.properties;
      if (properties && typeof properties === "object" && !Array.isArray(properties)) {
        for (const [key, propertySchema] of Object.entries(properties)) {
          if (!(key in record)) {
            continue;
          }
          if (!propertySchema || typeof propertySchema !== "object" || Array.isArray(propertySchema)) {
            continue;
          }

          const childType = typeof (propertySchema as Record<string, unknown>).type === "string"
            ? String((propertySchema as Record<string, unknown>).type)
            : undefined;

          if (childType && !isTypeMatch(childType, record[key])) {
            issues.push({ path: `${rootLabel}.${key}`, message: `Expected ${childType} value.` });
          }
        }
      }
    }

    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
  }
}

function isTypeMatch(expectedType: string, value: unknown): boolean {
  switch (expectedType) {
    case "object":
      return !!value && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}
