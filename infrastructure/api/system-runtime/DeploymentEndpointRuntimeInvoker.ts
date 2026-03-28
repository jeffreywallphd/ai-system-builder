import type { EndpointRuntimeInvocationRequest, EndpointRuntimeInvoker } from "../../../application/deployment/EndpointRoutingService";
import { ExternalSystemRuntimeInterface, type ExternalExecutionResponse } from "./ExternalSystemRuntimeInterface";
import type { SystemRuntimeApiResponse } from "./SystemRuntimeBackendApi";

export class DeploymentEndpointRuntimeInvoker implements EndpointRuntimeInvoker {
  public constructor(private readonly externalRuntime: ExternalSystemRuntimeInterface) {}

  public async invoke(request: EndpointRuntimeInvocationRequest): Promise<SystemRuntimeApiResponse<ExternalExecutionResponse>> {
    return this.externalRuntime.startExecution({
      systemId: request.systemId,
      versionId: request.versionId,
      executionId: request.executionId,
      async: request.async,
      idempotencyKey: request.idempotencyKey,
      inputPayload: request.inputPayload,
      inputContentType: request.inputContentType,
      inputSchemaVersion: request.inputSchemaVersion,
      context: request.context,
      callerContext: request.callerContext,
      authentication: request.authentication,
      tenantId: request.tenantId,
      requestSource: request.requestSource,
    });
  }
}
