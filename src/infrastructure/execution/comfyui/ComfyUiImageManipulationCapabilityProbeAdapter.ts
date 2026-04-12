import {
  ImageManipulationExecutionBackendHealthStates,
  type IImageManipulationExecutionCapabilityPort,
  type ImageManipulationExecutionBackendCapabilities,
  type ImageManipulationExecutionBackendStatus,
} from "@application/image-workflows/ports";
import {
  ComfyUiBackendProbeStates,
  type ComfyUiBackendProbeResult,
} from "./ComfyUiTransportClient";

export interface ComfyUiBackendProbeClient {
  probeBackend(input?: {
    readonly requiredNodeTypes?: ReadonlyArray<string>;
  }): Promise<ComfyUiBackendProbeResult>;
}

export interface ComfyUiImageManipulationCapabilityProbeAdapterOptions {
  readonly backendFamily?: string;
  readonly now?: () => Date;
  readonly supportedOperationKinds?: ReadonlyArray<string>;
  readonly supportedTranslationContractVersions?: ReadonlyArray<string>;
  readonly requiredNodeTypes?: ReadonlyArray<string>;
}

const defaultBackendFamily = "adapter.comfyui.image-manipulation";
const defaultSupportedOperationKinds = Object.freeze([
  "image-to-image",
  "enhance-upscale",
  "mask-guided-edit",
]);
const defaultSupportedTranslationContractVersions = Object.freeze(["1.0.0"]);
const defaultRequiredNodeTypes = Object.freeze([
  "LoadImage",
  "SaveImage",
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "VAEEncode",
  "KSampler",
  "VAEDecode",
  "ImageScaleBy",
  "SetLatentNoiseMask",
]);

export class ComfyUiImageManipulationCapabilityProbeAdapter implements IImageManipulationExecutionCapabilityPort {
  private readonly backendFamily: string;
  private readonly now: () => Date;
  private readonly supportedOperationKinds: ReadonlyArray<string>;
  private readonly supportedTranslationContractVersions: ReadonlyArray<string>;
  private readonly requiredNodeTypes: ReadonlyArray<string>;

  public constructor(
    private readonly transportClient: ComfyUiBackendProbeClient,
    options: ComfyUiImageManipulationCapabilityProbeAdapterOptions = {},
  ) {
    this.backendFamily = options.backendFamily?.trim() || defaultBackendFamily;
    this.now = options.now ?? (() => new Date());
    this.supportedOperationKinds = normalizeUniqueList(options.supportedOperationKinds, defaultSupportedOperationKinds);
    this.supportedTranslationContractVersions = normalizeUniqueList(
      options.supportedTranslationContractVersions,
      defaultSupportedTranslationContractVersions,
    );
    this.requiredNodeTypes = normalizeUniqueList(options.requiredNodeTypes, defaultRequiredNodeTypes);
  }

  public async getExecutionBackendStatus(input: {
    readonly workspaceId: string;
    readonly systemId?: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): Promise<ImageManipulationExecutionBackendStatus> {
    const probe = await this.transportClient.probeBackend({
      requiredNodeTypes: this.requiredNodeTypes,
    });
    const compatibility = evaluateCompatibility({
      operationKind: input.operationKind,
      translationContractVersion: input.translationContractVersion,
      supportedOperationKinds: this.supportedOperationKinds,
      supportedTranslationContractVersions: this.supportedTranslationContractVersions,
    });

    const readinessState = resolveReadinessState(probe, compatibility.compatible);
    const health = mapReadinessToHealth(readinessState);
    const checkedAt = probe.checkedAt || this.now().toISOString();
    const capabilities = this.buildCapabilities(probe);
    const message = buildMessage({
      readinessState,
      probeMessage: probe.message,
      compatibilityIssues: compatibility.issues,
    });

    return Object.freeze({
      backendFamily: this.backendFamily,
      health,
      checkedAt,
      message,
      capabilities,
      diagnostics: Object.freeze({
        readinessState,
        compatibility: Object.freeze({
          compatible: compatibility.compatible,
          issues: compatibility.issues,
        }),
        capabilityProbe: Object.freeze({
          state: probe.state,
          reachable: probe.reachable,
          responsive: probe.responsive,
          supportsCapabilityDiscovery: probe.capabilities.supportsCapabilityDiscovery,
          missingRequiredNodeTypes: probe.capabilities.missingRequiredNodeTypes,
        }),
      }),
    });
  }

  private buildCapabilities(probe: ComfyUiBackendProbeResult): ImageManipulationExecutionBackendCapabilities {
    return Object.freeze({
      backendFamily: this.backendFamily,
      supportsProgressPolling: probe.capabilities.supportsQueueInspection,
      supportsProgressStreaming: false,
      supportsCancellation: probe.capabilities.supportsCancellation,
      supportsOutputDiscovery: probe.capabilities.supportsPromptHistory,
      supportedOperationKinds: this.supportedOperationKinds,
      supportedTranslationContractVersions: this.supportedTranslationContractVersions,
    });
  }
}

function resolveReadinessState(
  probe: ComfyUiBackendProbeResult,
  compatibilityOk: boolean,
): "ready" | "degraded" | "unavailable" | "incompatible" {
  if (probe.state === ComfyUiBackendProbeStates.unavailable) {
    return "unavailable";
  }
  if (!compatibilityOk) {
    return "incompatible";
  }
  if (probe.state === ComfyUiBackendProbeStates.incompatible) {
    return "incompatible";
  }
  if (probe.state === ComfyUiBackendProbeStates.degraded) {
    return "degraded";
  }
  return "ready";
}

function mapReadinessToHealth(
  state: "ready" | "degraded" | "unavailable" | "incompatible",
): ImageManipulationExecutionBackendStatus["health"] {
  if (state === "ready") {
    return ImageManipulationExecutionBackendHealthStates.healthy;
  }
  if (state === "unavailable") {
    return ImageManipulationExecutionBackendHealthStates.unavailable;
  }
  return ImageManipulationExecutionBackendHealthStates.degraded;
}

function evaluateCompatibility(input: {
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
  readonly supportedOperationKinds: ReadonlyArray<string>;
  readonly supportedTranslationContractVersions: ReadonlyArray<string>;
}): {
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<string>;
} {
  const issues: string[] = [];

  if (input.operationKind && !input.supportedOperationKinds.includes(input.operationKind)) {
    issues.push(`unsupported-operation-kind:${input.operationKind}`);
  }
  if (
    input.translationContractVersion
    && !input.supportedTranslationContractVersions.includes(input.translationContractVersion)
  ) {
    issues.push(`unsupported-translation-contract-version:${input.translationContractVersion}`);
  }

  return Object.freeze({
    compatible: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

function buildMessage(input: {
  readonly readinessState: "ready" | "degraded" | "unavailable" | "incompatible";
  readonly probeMessage: string;
  readonly compatibilityIssues: ReadonlyArray<string>;
}): string {
  if (input.readinessState === "incompatible") {
    const issues = input.compatibilityIssues.join(", ");
    return issues
      ? `ComfyUI backend is reachable but incompatible with requested execution requirements: ${issues}.`
      : "ComfyUI backend is reachable but incompatible with required execution capabilities.";
  }
  if (input.readinessState === "degraded") {
    return "ComfyUI backend is reachable but degraded for readiness/capability checks.";
  }
  if (input.readinessState === "unavailable") {
    return "ComfyUI backend is unavailable for execution dispatch.";
  }
  return input.probeMessage;
}

function normalizeUniqueList(
  candidate: ReadonlyArray<string> | undefined,
  fallback: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const source = candidate && candidate.length > 0 ? candidate : fallback;
  const deduped = new Set<string>();
  for (const entry of source) {
    if (typeof entry !== "string") {
      continue;
    }
    const normalized = entry.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}
