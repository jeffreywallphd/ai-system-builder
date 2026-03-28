import { RuntimeEnvironmentKinds, type RuntimeEnvironmentKind } from "../../domain/system-runtime/RuntimeEnvironmentDomain";

export const ExternalExecutionEnvironmentOptions = Object.freeze({
  local: "local",
  mcp: "mcp",
  remote: "remote",
} as const);

export type ExternalExecutionEnvironmentOption =
  typeof ExternalExecutionEnvironmentOptions[keyof typeof ExternalExecutionEnvironmentOptions];

export interface ExternalExecutionEnvironmentRequest {
  readonly environmentId?: string;
  readonly option?: ExternalExecutionEnvironmentOption;
  readonly configuration?: {
    readonly requireNestedSystems?: boolean;
    readonly requireMcpMediatedExecution?: boolean;
  };
}

export interface NormalizedExecutionEnvironmentConfiguration {
  readonly requestedEnvironmentId?: string;
  readonly requestedEnvironmentKind?: RuntimeEnvironmentKind;
  readonly requireNestedSystems?: boolean;
  readonly requireMcpMediatedExecution?: boolean;
}

export interface SerializedExecutionEnvironment {
  readonly environmentId: string;
  readonly option: ExternalExecutionEnvironmentOption;
  readonly displayName: string;
  readonly capabilities: {
    readonly supportsNestedSystems: boolean;
    readonly supportsMcpMediatedExecution: boolean;
    readonly supportsStructuralKinds: ReadonlyArray<string>;
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toRuntimeKind(option: ExternalExecutionEnvironmentOption): RuntimeEnvironmentKind {
  return RuntimeEnvironmentKinds[option];
}

export class ExecutionEnvironmentConfigurationValidator {
  public validate(request?: ExternalExecutionEnvironmentRequest): NormalizedExecutionEnvironmentConfiguration {
    if (!request) {
      return Object.freeze({});
    }

    if (request.option && !Object.values(ExternalExecutionEnvironmentOptions).includes(request.option)) {
      throw new Error(`invalid-request:Unsupported execution environment option '${request.option}'.`);
    }

    const configuration = request.configuration ?? {};
    const requireNestedSystems = configuration.requireNestedSystems;
    const requireMcpMediatedExecution = configuration.requireMcpMediatedExecution;
    if (requireNestedSystems !== undefined && typeof requireNestedSystems !== "boolean") {
      throw new Error("invalid-request:Execution environment configuration 'requireNestedSystems' must be boolean.");
    }
    if (requireMcpMediatedExecution !== undefined && typeof requireMcpMediatedExecution !== "boolean") {
      throw new Error("invalid-request:Execution environment configuration 'requireMcpMediatedExecution' must be boolean.");
    }

    return Object.freeze({
      requestedEnvironmentId: normalizeOptional(request.environmentId),
      requestedEnvironmentKind: request.option ? toRuntimeKind(request.option) : undefined,
      requireNestedSystems,
      requireMcpMediatedExecution,
    });
  }
}

