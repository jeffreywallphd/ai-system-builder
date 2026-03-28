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

export interface StudioHandoffSdkTransportRequestContext {
  readonly authentication?: StudioHandoffSdkAuthentication;
  readonly accessContext?: StudioHandoffSdkAccessContext;
}

export interface StudioHandoffSdkTransport {
  initiateHandoff(
    request: StudioHandoffSdkInitiateRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkInitiateResponse>>;

  getHandoffStatus(
    request: StudioHandoffSdkStatusRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkStatusResponse>>;

  retryHandoff(
    request: StudioHandoffSdkRetryRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkRetryResponse>>;

  reconcileHandoff(
    request: StudioHandoffSdkRetryRequest,
    context?: StudioHandoffSdkTransportRequestContext,
  ): Promise<StudioHandoffSdkResponse<StudioHandoffSdkRetryResponse>>;
}
