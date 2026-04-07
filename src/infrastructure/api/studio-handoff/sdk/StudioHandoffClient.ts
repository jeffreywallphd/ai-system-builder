import type {
  StudioHandoffSdkAccessContext,
  StudioHandoffSdkAuthentication,
  StudioHandoffSdkInitiateRequest,
  StudioHandoffSdkInitiateResponse,
  StudioHandoffSdkResponse,
  StudioHandoffSdkRetryRequest,
  StudioHandoffSdkRetryResponse,
  StudioHandoffSdkStatusRequest,
  StudioHandoffSdkStatusResponse,
} from "./PublicStudioHandoffSdkContract";
import type { StudioHandoffSdkTransport, StudioHandoffSdkTransportRequestContext } from "./StudioHandoffSdkTransport";

export interface StudioHandoffClientOptions {
  readonly transport: StudioHandoffSdkTransport;
  readonly authentication?: StudioHandoffSdkAuthentication;
  readonly accessContext?: StudioHandoffSdkAccessContext;
}

function mergeContext(
  defaults: Pick<StudioHandoffClientOptions, "authentication" | "accessContext">,
  overrides?: StudioHandoffSdkTransportRequestContext,
): StudioHandoffSdkTransportRequestContext {
  return Object.freeze({
    authentication: overrides?.authentication ?? defaults.authentication,
    accessContext: overrides?.accessContext ?? defaults.accessContext,
  });
}

export class StudioHandoffClient {
  private readonly transport: StudioHandoffSdkTransport;
  private readonly defaultContext: StudioHandoffSdkTransportRequestContext;

  public constructor(options: StudioHandoffClientOptions) {
    this.transport = options.transport;
    this.defaultContext = Object.freeze({
      authentication: options.authentication,
      accessContext: options.accessContext,
    });
  }

  public initiateHandoff(
    request: StudioHandoffSdkInitiateRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkInitiateResponse>> {
    return this.transport.initiateHandoff(request, mergeContext(this.defaultContext, context));
  }

  public getHandoffStatus(
    request: StudioHandoffSdkStatusRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkStatusResponse>> {
    return this.transport.getHandoffStatus(request, mergeContext(this.defaultContext, context));
  }

  public retryHandoff(
    request: StudioHandoffSdkRetryRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkRetryResponse>> {
    return this.transport.retryHandoff(request, mergeContext(this.defaultContext, context));
  }

  public reconcileHandoff(
    request: StudioHandoffSdkRetryRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkRetryResponse>> {
    return this.transport.reconcileHandoff(request, mergeContext(this.defaultContext, context));
  }
}
