import { ComfyUiExecutionAdapterConfig } from "@infrastructure/config/ComfyUiExecutionAdapterConfig";
import {
  ComfyUiTransportClient,
  type ComfyUiTransportLogger,
} from "./ComfyUiTransportClient";
import {
  ComfyUiExecutionObservability,
  createComfyUiTransportLoggerBridge,
  type ComfyUiExecutionObservabilityLogger,
} from "./ComfyUiExecutionObservability";
import { ComfyUiOutputDiscoveryCollector } from "./ComfyUiOutputDiscoveryCollector";
import { ComfyUiRunExecutionTransportGateway } from "../runs/ComfyUiRunExecutionTransportGateway";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { ComfyUiImageManipulationCapabilityProbeAdapter } from "./ComfyUiImageManipulationCapabilityProbeAdapter";
import { ComfyUiExecutionCancellationAdapter } from "./ComfyUiExecutionCancellationAdapter";

export interface ComfyUiExecutionAdapterInfrastructure {
  readonly config: ComfyUiExecutionAdapterConfig;
  readonly transportClient: ComfyUiTransportClient;
  readonly runDispatchGateway: ComfyUiRunExecutionTransportGateway;
  readonly runDispatchAdapter: ComfyUiRunExecutionDispatchAdapter;
  readonly cancellationAdapter: ComfyUiExecutionCancellationAdapter;
  readonly capabilityProbeAdapter: ComfyUiImageManipulationCapabilityProbeAdapter;
  readonly outputDiscoveryCollector: ComfyUiOutputDiscoveryCollector;
}

export interface CreateComfyUiExecutionAdapterInfrastructureOptions {
  readonly config?: ComfyUiExecutionAdapterConfig;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly logger?: ComfyUiTransportLogger;
  readonly observabilityLogger?: ComfyUiExecutionObservabilityLogger;
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

  const observability = input.observabilityLogger
    ? new ComfyUiExecutionObservability({
      logger: input.observabilityLogger,
      now: input.now,
    })
    : undefined;

  const transportClient = new ComfyUiTransportClient({
    baseUrl,
    requestTimeoutMs: config.requestTimeoutMs,
    authToken: config.authToken,
    fetch: input.fetch,
    now: input.now,
    logger: input.logger ?? (observability ? createComfyUiTransportLoggerBridge(observability) : undefined),
  });
  const runDispatchGateway = new ComfyUiRunExecutionTransportGateway(transportClient);
  const runDispatchAdapter = new ComfyUiRunExecutionDispatchAdapter({
    gateway: runDispatchGateway,
    now: input.now,
    observability,
  });
  const capabilityProbeAdapter = new ComfyUiImageManipulationCapabilityProbeAdapter({
    transportClient,
    now: input.now,
  });
  const outputDiscoveryCollector = new ComfyUiOutputDiscoveryCollector({
    transportClient,
    now: input.now,
    observability,
  });
  const cancellationAdapter = new ComfyUiExecutionCancellationAdapter({
    transportClient,
    cleanupPort: outputDiscoveryCollector,
    now: input.now,
    observability,
  });

  return Object.freeze({
    config,
    transportClient,
    runDispatchGateway,
    runDispatchAdapter,
    cancellationAdapter,
    capabilityProbeAdapter,
    outputDiscoveryCollector,
  });
}
