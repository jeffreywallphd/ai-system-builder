import { describe, expect, it } from "bun:test";
import { createAssetContractDescriptor } from "../../../domain/contracts/AssetContract";
import { createSystemStudioTaxonomy } from "../../../domain/system-studio/SystemAssetDomain";
import {
  RuntimeExecutionInterfaceKinds,
  type RuntimeExecutionContract,
} from "../RuntimeExecutionContractMapping";
import { RuntimeInputValidationService } from "../RuntimeInputValidationService";

function createRuntimeContract(): RuntimeExecutionContract {
  return Object.freeze({
    systemAssetId: "system:test",
    systemVersionId: "system:test:v1",
    taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
    sourceContractVersion: "1.1.0",
    inputs: Object.freeze([
      Object.freeze({
        id: "request",
        required: true,
        valueType: "string",
        source: RuntimeExecutionInterfaceKinds.systemInput,
      }),
    ]),
    outputs: Object.freeze([
      Object.freeze({
        id: "response",
        valueType: "string",
        source: RuntimeExecutionInterfaceKinds.systemOutput,
      }),
    ]),
    parameters: Object.freeze([
      Object.freeze({
        id: "temperature",
        required: true,
        valueType: "number",
        source: RuntimeExecutionInterfaceKinds.systemParameter,
      }),
    ]),
    childInterfaces: Object.freeze([]),
    recursion: Object.freeze({
      maxDepth: 4,
      status: "complete",
      nestedSystemCount: 0,
      unresolvedNestedSystemCount: 0,
    }),
  });
}

describe("RuntimeInputValidationService", () => {
  it("accepts valid contract-aligned payloads", () => {
    const service = new RuntimeInputValidationService();
    const result = service.validate({
      inputPayload: {
        request: "hello",
        parameters: { temperature: 0.3 },
        config: { invocationMode: "deferred", sideEffects: "bounded" },
      },
      runtimeContract: createRuntimeContract(),
      contract: createAssetContractDescriptor({
        version: "1.1.0",
        input: {
          kind: "json-schema",
          schema: {
            type: "object",
            properties: { request: { type: "string" } },
            required: ["request"],
            additionalProperties: false,
          },
        },
        output: { kind: "json-schema" },
        parameters: [],
        execution: { invocationMode: "deferred", sideEffects: "bounded" },
      }),
    });

    expect(result.valid).toBeTrue();
    expect(result.errors).toEqual([]);
  });

  it("rejects missing required runtime inputs with deterministic structured errors", () => {
    const service = new RuntimeInputValidationService();
    const result = service.validate({
      inputPayload: {},
      runtimeContract: createRuntimeContract(),
      contract: createAssetContractDescriptor({
        version: "1.1.0",
        input: { kind: "json-schema", schema: { type: "object" } },
        output: { kind: "json-schema" },
        parameters: [],
      }),
    });

    expect(result.valid).toBeFalse();
    expect(result.errors.some((entry) => entry.code === "missing-required-input" && entry.path === "inputPayload.request")).toBeTrue();
  });

  it("rejects unsupported input keys and invalid parameter/config shapes", () => {
    const service = new RuntimeInputValidationService();
    const result = service.validate({
      inputPayload: {
        request: "ok",
        unknown: true,
        parameters: { temperature: "hot", unknownParam: 1 },
        config: { invocationMode: 42, extra: true },
      },
      runtimeContract: createRuntimeContract(),
      contract: createAssetContractDescriptor({
        version: "1.1.0",
        input: { kind: "json-schema", schema: { type: "object", properties: { request: { type: "string" } } } },
        output: { kind: "json-schema" },
        parameters: [],
        execution: { invocationMode: "deferred", sideEffects: "bounded" },
      }),
    });

    expect(result.valid).toBeFalse();
    const codes = new Set(result.errors.map((entry) => entry.code));
    expect(codes.has("unsupported-input-key")).toBeTrue();
    expect(codes.has("invalid-parameter-type")).toBeTrue();
    expect(codes.has("unsupported-parameter-key")).toBeTrue();
    expect(codes.has("invalid-config-type")).toBeTrue();
    expect(codes.has("unsupported-config-key")).toBeTrue();
  });
});
