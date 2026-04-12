import type { WorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import type {
  RuntimeCapabilityBindingContract,
} from "../system-runtime/RuntimeCapabilityBindingContract";
import type { RuntimeExecutionOptionOverride } from "../system-runtime/ExecutionOptionCapabilityContract";
import {
  runRuntimeCapabilityPreflight,
  type RuntimeCapabilityPreflightFailure,
} from "../system-runtime/RuntimeCapabilityExecutionPreflight";
import type { ModelCapabilityDescriptor } from "../system-runtime/ModelCapabilityBindingRules";
import { ComfyRuntimeCapabilityTranslator } from "@infrastructure/comfyui/execution/mappers/ComfyRuntimeCapabilityTranslator";
import type {
  ComfyImageManipulationDatasetRuntimeHandle,
} from "./ComfyImageManipulationDatasetBindingAsset";

export interface ComfyRuntimeEnvironmentResolutionInput {
  readonly backendId?: string;
  readonly runtimeProfile?: string;
  readonly apiBaseUrl?: string;
  readonly capabilityTags?: ReadonlyArray<string>;
  readonly dependencyRefs?: ReadonlyArray<string>;
  readonly executionOptions?: RuntimeExecutionOptionOverride;
}

export interface ResolveComfyImageManipulationRuntimeRequest {
  readonly workflowTemplate: Pick<WorkflowTemplateDefinition, "templateId" | "versionId" | "executionMetadata" | "metadata">;
  readonly datasetHandles: ReadonlyArray<ComfyImageManipulationDatasetRuntimeHandle>;
  readonly runtimeEnvironment?: ComfyRuntimeEnvironmentResolutionInput;
  readonly capabilityBinding?: RuntimeCapabilityBindingContract;
  readonly modelDescriptors?: ReadonlyArray<ModelCapabilityDescriptor>;
  readonly requestedModelBindingId?: string;
}

export interface ComfyImageManipulationRuntimeResolution {
  readonly backendId: string;
  readonly runtimeProfile: string;
  readonly endpoint: Readonly<{
    readonly apiBaseUrl: string;
    readonly source: "environment" | "metadata";
  }>;
  readonly executionConfig?: Readonly<Record<string, unknown>>;
  readonly dependencies: Readonly<{
    readonly required: ReadonlyArray<string>;
    readonly resolved: ReadonlyArray<string>;
    readonly missing: ReadonlyArray<string>;
  }>;
  readonly storage: Readonly<{
    readonly inputStorageInstanceRefs: ReadonlyArray<string>;
    readonly outputStorageInstanceRefs: ReadonlyArray<string>;
  }>;
  readonly diagnostics: Readonly<{
    readonly issues: ReadonlyArray<string>;
    readonly warnings: ReadonlyArray<string>;
    readonly capabilityFailure?: RuntimeCapabilityPreflightFailure["failure"];
  }>;
}

function normalizeUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function normalizeList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])]
    .map((entry) => entry.trim())
    .filter(Boolean));
}

function resolveStorageRefs(
  handles: ReadonlyArray<ComfyImageManipulationDatasetRuntimeHandle>,
): ComfyImageManipulationRuntimeResolution["storage"] {
  const inputRefs = new Set<string>();
  const outputRefs = new Set<string>();
  for (const handle of handles) {
    const storageRef = handle.storageInstanceRef?.trim();
    if (!storageRef) {
      continue;
    }
    if (handle.referenceId.includes("output")) {
      outputRefs.add(storageRef);
      continue;
    }
    inputRefs.add(storageRef);
  }

  return Object.freeze({
    inputStorageInstanceRefs: Object.freeze([...inputRefs]),
    outputStorageInstanceRefs: Object.freeze([...outputRefs]),
  });
}

export function resolveComfyImageManipulationRuntimeConfiguration(
  request: ResolveComfyImageManipulationRuntimeRequest,
): ComfyImageManipulationRuntimeResolution {
  const runtime = request.workflowTemplate.executionMetadata?.runtime;
  const backendId = request.runtimeEnvironment?.backendId ?? runtime?.backendId ?? "runtime:comfyui";
  const runtimeProfile = request.runtimeEnvironment?.runtimeProfile ?? runtime?.runtimeProfile ?? "comfyui";

  const metadataEndpoint = normalizeUrl(request.workflowTemplate.metadata["runtimeApiBaseUrl"]);
  const environmentEndpoint = normalizeUrl(request.runtimeEnvironment?.apiBaseUrl);
  const endpoint = environmentEndpoint ?? metadataEndpoint;

  const issues: string[] = [];
  const warnings: string[] = [];

  if (!endpoint) {
    issues.push("Comfy runtime endpoint is required but was not resolved from runtime environment or template metadata.");
  }

  const requiredDependencies = new Set<string>([
    ...normalizeList(runtime?.requiredDependencies),
    ...normalizeList(request.runtimeEnvironment?.dependencyRefs),
  ]);
  const resolvedDependencies = new Set<string>();

  if (request.capabilityBinding) {
    resolvedDependencies.add(request.capabilityBinding.executionProvider.providerId);
    resolvedDependencies.add(request.capabilityBinding.modelBindingId);
  }

  const allCapabilityTags = new Set<string>([
    ...normalizeList(request.capabilityBinding?.workflowExecutionProfile.requiredCapabilityTags),
    ...normalizeList(request.runtimeEnvironment?.capabilityTags),
  ]);

  let executionConfig: Readonly<Record<string, unknown>> | undefined;
  let capabilityFailure: RuntimeCapabilityPreflightFailure["failure"] | undefined;

  if (request.capabilityBinding) {
    const preflight = runRuntimeCapabilityPreflight({
      binding: request.capabilityBinding,
      providerId: request.capabilityBinding.executionProvider.providerId,
      providerCapabilities: Object.freeze([...allCapabilityTags]),
      modelPolicy: {
        policyId: "image-manipulation:runtime-resolution",
        allowedBindings: [{
          bindingId: request.capabilityBinding.modelBindingId,
          descriptorId: request.capabilityBinding.modelBindingId,
          required: true,
          defaultForProfiles: [request.capabilityBinding.workflowExecutionProfile.profileId],
        }],
        defaultBindingId: request.capabilityBinding.modelBindingId,
      },
      modelDescriptors: request.modelDescriptors ?? [{
        descriptorId: request.capabilityBinding.modelBindingId,
        modelAssetId: request.capabilityBinding.modelBindingId,
        supportedExecutionProfiles: [request.capabilityBinding.workflowExecutionProfile.profileId],
        supportedExecutionProviders: [request.capabilityBinding.executionProvider.providerId],
      }],
      requestedModelBindingId: request.requestedModelBindingId,
      workflowDefaults: request.runtimeEnvironment?.executionOptions,
      translator: new ComfyRuntimeCapabilityTranslator(),
    });

    if (preflight.ok) {
      executionConfig = Object.freeze({ ...preflight.providerConfig });
      resolvedDependencies.add(preflight.modelBinding.bindingId);
    } else {
      capabilityFailure = preflight.failure;
      warnings.push(preflight.failure.userSafeMessage);
    }
  }

  const missingDependencies = [...requiredDependencies].filter((entry) => !resolvedDependencies.has(entry));

  return Object.freeze({
    backendId,
    runtimeProfile,
    endpoint: Object.freeze({
      apiBaseUrl: endpoint ?? "",
      source: environmentEndpoint ? "environment" : "metadata",
    }),
    executionConfig,
    dependencies: Object.freeze({
      required: Object.freeze([...requiredDependencies]),
      resolved: Object.freeze([...resolvedDependencies]),
      missing: Object.freeze(missingDependencies),
    }),
    storage: resolveStorageRefs(request.datasetHandles),
    diagnostics: Object.freeze({
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
      capabilityFailure,
    }),
  });
}

