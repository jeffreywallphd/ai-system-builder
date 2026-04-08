import { ComfyUiExecutionAdapterConfig } from "@infrastructure/config/ComfyUiExecutionAdapterConfig";
import {
  ComfyUiTransportClient,
  type ComfyUiTransportLogger,
} from "./ComfyUiTransportClient";
import { ComfyUiRunExecutionTransportGateway } from "../runs/ComfyUiRunExecutionTransportGateway";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { ComfyUiImageManipulationCapabilityProbeAdapter } from "./ComfyUiImageManipulationCapabilityProbeAdapter";

export interface ComfyUiExecutionAdapterInfrastructure {
  readonly config: ComfyUiExecutionAdapterConfig;
  readonly transportClient: ComfyUiTransportClient;
  readonly runDispatchGateway: ComfyUiRunExecutionTransportGateway;
  readonly runDispatchAdapter: ComfyUiRunExecutionDispatchAdapter;
  readonly capabilityProbeAdapter: ComfyUiImageManipulationCapabilityProbeAdapter;
}

export interface CreateComfyUiExecutionAdapterInfrastructureOptions {
  readonly config?: ComfyUiExecutionAdapterConfig;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly logger?: ComfyUiTransportLogger;
}

export function createComfyUiExecutionAdapterInfrastructure(
  input: CreateComfyUiExecutionAdapterInfrastructureOptions = {},
): ComfyUiExecutionAdapterInfrastructure | undefined {
  const config = input.config
    ?? ComfyUiExecutionAdapterConfig.fromEnv(input.env ?? process.env);

  if (!config.enabled) {
    return undefined;
  }

  const baseUrl = config.baseUrl;
  if (!baseUrl) {
    throw new Error("ComfyUI execution adapter infrastructure requires a configured baseUrl.");
  }

  const transportClient = new ComfyUiTransportClient({
    baseUrl,
    requestTimeoutMs: config.requestTimeoutMs,
    authToken: config.authToken,
    fetch: input.fetch,
    now: input.now,
    logger: input.logger,
  });
  const runDispatchGateway = new ComfyUiRunExecutionTransportGateway(transportClient);
  const runDispatchAdapter = new ComfyUiRunExecutionDispatchAdapter({
    gateway: runDispatchGateway,
    now: input.now,
  });
  const capabilityProbeAdapter = new ComfyUiImageManipulationCapabilityProbeAdapter({
    transportClient,
    now: input.now,
  });

  return Object.freeze({
    config,
    transportClient,
    runDispatchGateway,
    runDispatchAdapter,
    capabilityProbeAdapter,
  });
}
