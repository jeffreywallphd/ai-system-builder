import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import {
  RuntimeExecutionInterfaceKinds,
  type RuntimeExecutionContract,
  type RuntimeExecutionParameter,
} from "./RuntimeExecutionContractMapping";

export const RuntimeValidationErrorCodes = Object.freeze({
  invalidPayloadType: "invalid-payload-type",
  missingRequiredInput: "missing-required-input",
  unsupportedInputKey: "unsupported-input-key",
  invalidInputType: "invalid-input-type",
  invalidParametersPayload: "invalid-parameters-payload",
  unsupportedParameterKey: "unsupported-parameter-key",
  missingRequiredParameter: "missing-required-parameter",
  invalidParameterType: "invalid-parameter-type",
  invalidConfigPayload: "invalid-config-payload",
  unsupportedConfigKey: "unsupported-config-key",
  invalidConfigType: "invalid-config-type",
});

export type RuntimeValidationErrorCode = typeof RuntimeValidationErrorCodes[keyof typeof RuntimeValidationErrorCodes];

export interface RuntimeValidationError {
  readonly code: RuntimeValidationErrorCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface RuntimeInputValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<RuntimeValidationError>;
}

export class RuntimeInputValidationFailure extends Error {
  public readonly validationErrors: ReadonlyArray<RuntimeValidationError>;

  public constructor(validationErrors: ReadonlyArray<RuntimeValidationError>) {
    super("invalid-request:Runtime input validation failed.");
    this.name = "RuntimeInputValidationFailure";
    this.validationErrors = Object.freeze([...validationErrors]);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inferValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function matchesDeclaredType(value: unknown, declaredType?: string): boolean {
  if (!declaredType || declaredType === "any" || declaredType === "unknown") {
    return true;
  }
  const normalized = declaredType.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized === "integer") {
    return typeof value === "number" && Number.isInteger(value);
  }
  if (normalized === "number") {
    return typeof value === "number";
  }
  if (normalized === "boolean") {
    return typeof value === "boolean";
  }
  if (normalized === "string" || normalized === "text") {
    return typeof value === "string";
  }
  if (normalized === "object") {
    return isRecord(value);
  }
  if (normalized === "array") {
    return Array.isArray(value);
  }
  if (normalized === "null") {
    return value === null;
  }
  return true;
}

function sortValidationErrors(
  errors: ReadonlyArray<RuntimeValidationError>,
): ReadonlyArray<RuntimeValidationError> {
  return Object.freeze([...errors].sort((left, right) => (
    `${left.path}:${left.code}:${left.message}`.localeCompare(`${right.path}:${right.code}:${right.message}`)
  )));
}

export class RuntimeInputValidationService {
  public validate(input: {
    readonly inputPayload?: unknown;
    readonly runtimeContract: RuntimeExecutionContract;
    readonly contract?: AssetContractDescriptor;
  }): RuntimeInputValidationResult {
    if (input.inputPayload === undefined) {
      return Object.freeze({
        valid: true,
        errors: Object.freeze([]),
      });
    }

    const errors: RuntimeValidationError[] = [];
    const normalizedPayload = input.inputPayload;

    if (!isRecord(normalizedPayload)) {
      errors.push(Object.freeze({
        code: RuntimeValidationErrorCodes.invalidPayloadType,
        path: "inputPayload",
        message: "Runtime input payload must be an object when invoking a system execution contract.",
        expected: "object",
        actual: inferValueType(normalizedPayload),
      }));
      return Object.freeze({ valid: false, errors: sortValidationErrors(errors) });
    }

    const payloadRecord = normalizedPayload;
    const inputIds = new Set(input.runtimeContract.inputs.map((entry) => entry.id));
    const requiredInputIds = new Set(input.runtimeContract.inputs.filter((entry) => entry.required).map((entry) => entry.id));
    const topLevelReserved = new Set(["parameters", "config"]);
    const schemaAdditionalProperties = (
      input.contract?.input?.kind === "json-schema"
      && input.contract.input.schema
      && typeof input.contract.input.schema === "object"
      && !Array.isArray(input.contract.input.schema)
      && "additionalProperties" in input.contract.input.schema
    )
      ? (input.contract.input.schema as { readonly additionalProperties?: unknown }).additionalProperties
      : undefined;
    const rejectUnsupportedInputs = schemaAdditionalProperties === false || inputIds.size > 0;

    for (const requiredInput of requiredInputIds) {
      if (!(requiredInput in payloadRecord) || payloadRecord[requiredInput] === undefined) {
        errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.missingRequiredInput,
          path: `inputPayload.${requiredInput}`,
          message: `Required runtime input '${requiredInput}' is missing.`,
        }));
      }
    }

    for (const key of Object.keys(payloadRecord).sort((left, right) => left.localeCompare(right))) {
      if (topLevelReserved.has(key)) {
        continue;
      }

      if (!inputIds.has(key) && rejectUnsupportedInputs) {
        errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.unsupportedInputKey,
          path: `inputPayload.${key}`,
          message: `Input '${key}' is not declared by the resolved runtime execution contract.`,
        }));
        continue;
      }

      const inputDescriptor = input.runtimeContract.inputs.find((entry) => entry.id === key);
      if (!inputDescriptor) {
        continue;
      }

      const value = payloadRecord[key];
      if (value === undefined) {
        continue;
      }
      if (!matchesDeclaredType(value, inputDescriptor.valueType)) {
        errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.invalidInputType,
          path: `inputPayload.${key}`,
          message: `Input '${key}' does not match declared type '${inputDescriptor.valueType ?? "unknown"}'.`,
          expected: inputDescriptor.valueType,
          actual: inferValueType(value),
        }));
      }
    }

    this.validateParameters({
      parametersPayload: payloadRecord.parameters,
      runtimeParameters: input.runtimeContract.parameters,
      errors,
    });
    this.validateConfig({
      configPayload: payloadRecord.config,
      contract: input.contract,
      errors,
    });

    const sorted = sortValidationErrors(errors);
    return Object.freeze({ valid: sorted.length === 0, errors: sorted });
  }

  private validateParameters(input: {
    readonly parametersPayload: unknown;
    readonly runtimeParameters: ReadonlyArray<RuntimeExecutionParameter>;
    readonly errors: RuntimeValidationError[];
  }): void {
    if (input.parametersPayload === undefined) {
      return;
    }

    if (!isRecord(input.parametersPayload)) {
      input.errors.push(Object.freeze({
        code: RuntimeValidationErrorCodes.invalidParametersPayload,
        path: "inputPayload.parameters",
        message: "Runtime input 'parameters' must be an object.",
        expected: "object",
        actual: inferValueType(input.parametersPayload),
      }));
      return;
    }

    const runtimeParameters = input.runtimeParameters.filter((entry) => entry.source === RuntimeExecutionInterfaceKinds.systemParameter);
    const parameterMap = new Map(runtimeParameters.map((entry) => [entry.id, entry] as const));
    const required = runtimeParameters.filter((entry) => entry.required && entry.defaultValue === undefined);

    for (const requiredParameter of required) {
      if (!(requiredParameter.id in input.parametersPayload)) {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.missingRequiredParameter,
          path: `inputPayload.parameters.${requiredParameter.id}`,
          message: `Required runtime parameter '${requiredParameter.id}' is missing.`,
        }));
      }
    }

    for (const key of Object.keys(input.parametersPayload).sort((left, right) => left.localeCompare(right))) {
      const descriptor = parameterMap.get(key);
      if (!descriptor) {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.unsupportedParameterKey,
          path: `inputPayload.parameters.${key}`,
          message: `Parameter '${key}' is not declared as a runtime system parameter.`,
        }));
        continue;
      }

      const value = input.parametersPayload[key];
      if (value === undefined) {
        continue;
      }
      if (!matchesDeclaredType(value, descriptor.valueType)) {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.invalidParameterType,
          path: `inputPayload.parameters.${key}`,
          message: `Parameter '${key}' does not match declared type '${descriptor.valueType ?? "unknown"}'.`,
          expected: descriptor.valueType,
          actual: inferValueType(value),
        }));
      }
    }
  }

  private validateConfig(input: {
    readonly configPayload: unknown;
    readonly contract?: AssetContractDescriptor;
    readonly errors: RuntimeValidationError[];
  }): void {
    if (input.configPayload === undefined) {
      return;
    }

    if (!isRecord(input.configPayload)) {
      input.errors.push(Object.freeze({
        code: RuntimeValidationErrorCodes.invalidConfigPayload,
        path: "inputPayload.config",
        message: "Runtime input 'config' must be an object.",
        expected: "object",
        actual: inferValueType(input.configPayload),
      }));
      return;
    }

    const allowedConfigKeys = new Set<string>();
    if (input.contract?.execution?.invocationMode !== undefined) {
      allowedConfigKeys.add("invocationMode");
      const value = input.configPayload.invocationMode;
      if (value !== undefined && typeof value !== "string") {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.invalidConfigType,
          path: "inputPayload.config.invocationMode",
          message: "Config field 'invocationMode' must be a string.",
          expected: "string",
          actual: inferValueType(value),
        }));
      }
    }
    if (input.contract?.execution?.sideEffects !== undefined) {
      allowedConfigKeys.add("sideEffects");
      const value = input.configPayload.sideEffects;
      if (value !== undefined && typeof value !== "string") {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.invalidConfigType,
          path: "inputPayload.config.sideEffects",
          message: "Config field 'sideEffects' must be a string.",
          expected: "string",
          actual: inferValueType(value),
        }));
      }
    }

    for (const key of Object.keys(input.configPayload).sort((left, right) => left.localeCompare(right))) {
      if (!allowedConfigKeys.has(key)) {
        input.errors.push(Object.freeze({
          code: RuntimeValidationErrorCodes.unsupportedConfigKey,
          path: `inputPayload.config.${key}`,
          message: `Config key '${key}' is not modeled by the runtime execution contract.`,
        }));
      }
    }
  }
}

