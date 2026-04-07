import { describe, expect, it } from "bun:test";
import { McpToolContractValidationService } from "../McpToolContractValidationService";
import type { McpToolDefinition } from "@domain/mcp/McpToolCapability";

const definition: McpToolDefinition = Object.freeze({
  id: "mcp:local:validator",
  version: "1.0.0",
  displayName: "Validator",
  sideEffects: "none",
  auth: Object.freeze({ kind: "none" }),
  tags: Object.freeze([]),
  categories: Object.freeze([]),
  inputSchema: Object.freeze({
    type: "object",
    required: ["payload", "mode"],
    properties: {
      payload: {
        type: "object",
        required: ["records"],
        properties: {
          records: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "label"],
              properties: {
                id: { type: "integer" },
                label: { type: "string", enum: ["ok", "warn"] },
              },
            },
          },
          note: { type: "string", nullable: true },
        },
      },
      mode: { type: "string", enum: ["strict", "relaxed"] },
    },
  }),
  outputSchema: Object.freeze({
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["accepted", "rejected"] },
      warnings: { type: "array", items: { type: "string" } },
    },
  }),
});

describe("McpToolContractValidationService", () => {
  it("validates nested objects, arrays, nullable values, and enums", () => {
    const service = new McpToolContractValidationService();

    const validInput = service.validateInput(definition, {
      payload: {
        records: [{ id: 1, label: "ok" }],
        note: null,
      },
      mode: "strict",
    });

    expect(validInput.valid).toBe(true);

    const invalidInput = service.validateInput(definition, {
      payload: {
        records: [{ id: 1.25, label: "bad" }],
      },
      mode: "invalid",
    });

    expect(invalidInput.valid).toBe(false);
    expect(invalidInput.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "input.payload.records[0].id" }),
        expect.objectContaining({ path: "input.payload.records[0].label" }),
        expect.objectContaining({ path: "input.mode" }),
      ]),
    );
  });

  it("validates output contract with precise issue paths", () => {
    const service = new McpToolContractValidationService();
    const result = service.validateOutput(definition, {
      status: "accepted",
      warnings: ["ok", 1],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([expect.objectContaining({ path: "output.warnings[1]", message: "Expected string value." })]);
  });
});

