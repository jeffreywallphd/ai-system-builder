import type { McpToolDefinition } from "@domain/mcp/McpToolCapability";

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
    this.validateValueAgainstSchema(schema, value, rootLabel, issues);

    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
  }

  private validateValueAgainstSchema(
    schema: Readonly<Record<string, unknown>>,
    value: unknown,
    path: string,
    issues: McpContractValidationIssue[],
  ): void {
    const nullable = schema.nullable === true;
    if (value === null) {
      if (!nullable) {
        issues.push({ path, message: "Value cannot be null." });
      }
      return;
    }

    const expectedType = typeof schema.type === "string" ? schema.type : undefined;
    if (expectedType && !isTypeMatch(expectedType, value)) {
      issues.push({ path, message: `Expected ${expectedType} value.` });
      return;
    }

    const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;
    if (enumValues && !enumValues.some((candidate) => Object.is(candidate, value))) {
      issues.push({ path, message: `Expected one of: ${enumValues.map((candidate) => JSON.stringify(candidate)).join(", ")}.` });
      return;
    }

    if (expectedType === "object" && value && typeof value === "object" && !Array.isArray(value)) {
      this.validateObjectSchema(schema, value as Record<string, unknown>, path, issues);
      return;
    }

    if (expectedType === "array" && Array.isArray(value)) {
      this.validateArraySchema(schema, value, path, issues);
    }
  }

  private validateObjectSchema(
    schema: Readonly<Record<string, unknown>>,
    value: Record<string, unknown>,
    path: string,
    issues: McpContractValidationIssue[],
  ): void {
    const requiredFields = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [];

    for (const required of requiredFields) {
      if (!(required in value)) {
        issues.push({ path: `${path}.${required}`, message: "Missing required value." });
      }
    }

    const properties = asRecord(schema.properties);
    if (!properties) {
      return;
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in value)) {
        continue;
      }
      const nestedSchema = asRecord(propertySchema);
      if (!nestedSchema) {
        continue;
      }
      this.validateValueAgainstSchema(nestedSchema, value[key], `${path}.${key}`, issues);
    }
  }

  private validateArraySchema(
    schema: Readonly<Record<string, unknown>>,
    value: ReadonlyArray<unknown>,
    path: string,
    issues: McpContractValidationIssue[],
  ): void {
    const itemSchema = asRecord(schema.items);
    if (!itemSchema) {
      return;
    }

    for (let index = 0; index < value.length; index += 1) {
      this.validateValueAgainstSchema(itemSchema, value[index], `${path}[${index}]`, issues);
    }
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

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

