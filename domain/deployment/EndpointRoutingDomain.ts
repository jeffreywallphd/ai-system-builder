import type { ExecutionContext } from "../system-runtime/SystemRuntimeDomain";
import type { EndpointCallableMetadata, ResolvedEndpointDeployment } from "./SystemEndpointExposureDomain";

export interface EndpointRouteRequest {
  readonly endpointId: string;
  readonly invocation: {
    readonly executionId?: string;
    readonly async?: boolean;
    readonly idempotencyKey?: string;
    readonly inputPayload?: unknown;
    readonly inputContentType?: string;
    readonly inputSchemaVersion?: string;
    readonly context?: ExecutionContext;
  };
  readonly callerContext?: {
    readonly callerKind: "user" | "session" | "system" | "anonymous";
    readonly callerId?: string;
    readonly sessionId?: string;
    readonly roles?: ReadonlyArray<string>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
  readonly authentication?: {
    readonly bearerToken?: string;
  };
  readonly tenantId?: string;
  readonly requestSource?: string;
}

export interface ResolvedDeployedEndpoint {
  readonly endpointId: string;
  readonly endpointName: string;
  readonly callable: EndpointCallableMetadata;
  readonly deploymentId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly targetId: string;
  readonly targetType: ResolvedEndpointDeployment["targetType"];
  readonly deploymentEnvironmentId: string;
  readonly tenantId?: string;
  readonly activationUpdatedAt: string;
  readonly nestedSystemCount: number;
  readonly runtimeContextKey: string;
}

export interface EndpointRouteResolution {
  readonly request: EndpointRouteRequest;
  readonly resolvedEndpoint: ResolvedDeployedEndpoint;
}

export interface EndpointInvocationResult {
  readonly route: EndpointRouteResolution;
  readonly runtimeResponse: unknown;
}
