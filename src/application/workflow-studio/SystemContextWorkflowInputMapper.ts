import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { SystemContextContract } from "@domain/system-studio/SystemContextContract";
import {
  SystemContextWorkflowMappingContractVersion,
  SystemContextWorkflowMappingSourceRoots,
  SystemContextWorkflowMappingTargetKinds,
  createSystemContextWorkflowMappingConfiguration,
  type SystemContextWorkflowMappingConfiguration,
  type SystemContextWorkflowMappingEntry,
  type SystemContextWorkflowMappingSourceRoot,
} from "@domain/system-studio/SystemContextWorkflowMappingConfiguration";
import {
  createDefaultSystemContextDatasetReferenceResolver,
  type ResolveSystemContextDatasetsResult,
  type SystemContextDatasetReferenceResolver,
} from "./SystemContextDatasetReferenceResolver";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function inferRecordValueType(value: unknown): "string" | "number" | "boolean" | "array" | "object" | "unknown" {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    return "object";
  }
  return "unknown";
}

export interface WorkflowSystemContextBindingAdapter {
  readonly map: (context: SystemContextContract) => WorkflowExecutionPlanTranslationRequest["context"];
}

export interface CreateWorkflowSystemContextBindingAdapterOptions {
  readonly datasetReferenceResolver?: SystemContextDatasetReferenceResolver;
  readonly mappingConfiguration?: SystemContextWorkflowMappingConfiguration;
  readonly valueTransformers?: Readonly<Record<string, (value: unknown, context: {
    readonly systemContext: SystemContextContract;
    readonly datasetResolution: ResolveSystemContextDatasetsResult;
    readonly sourceRoot: SystemContextWorkflowMappingSourceRoot;
    readonly mapping: SystemContextWorkflowMappingEntry;
  }) => unknown>>;
}

interface SystemContextWorkflowMappingIssue {
  readonly mappingId: string;
  readonly code: "source-value-missing" | "transformer-missing";
  readonly message: string;
}

const DefaultSystemContextWorkflowMappingConfiguration = createSystemContextWorkflowMappingConfiguration({
  contractVersion: SystemContextWorkflowMappingContractVersion,
  mappings: [
    { mappingId: "input.parameters", sourceRoot: "parameters", targetKind: "workflow-input", targetPath: "" },
    { mappingId: "metadata.system-context", sourceRoot: "system-context", targetKind: "workflow-metadata", targetPath: "systemContext" },
    { mappingId: "metadata.system-form", sourceRoot: "parameters", targetKind: "workflow-metadata", targetPath: "systemFormValues" },
    { mappingId: "metadata.ui-form", sourceRoot: "parameters", targetKind: "workflow-metadata", targetPath: "uiFormValues" },
    { mappingId: "metadata.form", sourceRoot: "parameters", targetKind: "workflow-metadata", targetPath: "formValues" },
    { mappingId: "metadata.selected-images", sourceRoot: "selected-images", targetKind: "workflow-metadata", targetPath: "selectedImages" },
    { mappingId: "metadata.selected-image", sourceRoot: "selected-image", targetKind: "workflow-metadata", targetPath: "selectedImage", transformId: "selected-image-summary" },
    { mappingId: "metadata.dataset-instances", sourceRoot: "dataset-resolution", targetKind: "workflow-metadata", targetPath: "datasetInstances", transformId: "dataset-instances" },
    { mappingId: "metadata.dataset-instance-references", sourceRoot: "dataset-resolution", targetKind: "workflow-metadata", targetPath: "datasetInstanceReferences", transformId: "dataset-instances" },
    { mappingId: "metadata.dataset-runtime-handles", sourceRoot: "dataset-resolution", targetKind: "workflow-metadata", targetPath: "datasetRuntimeHandles", transformId: "dataset-runtime-handles" },
    { mappingId: "metadata.system-dataset-refs", sourceRoot: "dataset-resolution", targetKind: "workflow-metadata", targetPath: "systemDatasetInstanceRefs", transformId: "system-dataset-instance-refs" },
    { mappingId: "metadata.dataset-resolution", sourceRoot: "dataset-resolution", targetKind: "workflow-metadata", targetPath: "datasetResolution", transformId: "dataset-resolution-metadata" },
    { mappingId: "metadata.runtime-context", sourceRoot: "runtime", targetKind: "workflow-metadata", targetPath: "runtimeContext", transformId: "runtime-context" },
  ],
});

function parsePath(path?: string): ReadonlyArray<string | number> {
  const normalized = (path ?? "").trim();
  if (!normalized) {
    return Object.freeze([]);
  }

  return Object.freeze(normalized
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => {
      const token = segment.trim();
      if (!token) {
        return undefined;
      }
      return /^\d+$/.test(token) ? Number(token) : token;
    })
    .filter((segment): segment is string | number => segment !== undefined));
}

function readByPath(source: unknown, path?: string): unknown {
  const segments = parsePath(path);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return undefined;
      }
      current = current[segment];
      continue;
    }
    if (typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setByPath(target: Record<string, unknown>, path: string | undefined, value: unknown): void {
  const segments = parsePath(path);
  if (segments.length === 0 && value && typeof value === "object" && !Array.isArray(value)) {
    Object.assign(target, value);
    return;
  }
  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;
  segments.forEach((segment, index) => {
    if (typeof segment === "number") {
      return;
    }
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    const existing = current[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  });
}

function mapDatasetResolutionToMetadata(
  resolution: ResolveSystemContextDatasetsResult,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    resolvedCount: resolution.resolved.length,
    unresolvedCount: resolution.unresolved.length,
    issueCount: resolution.issues.length,
    issues: Object.freeze(resolution.issues.map((issue) => Object.freeze({ ...issue }))),
    resolvedReferences: Object.freeze(resolution.resolved.map((entry) => Object.freeze({
      referenceId: entry.referenceId,
      instanceId: entry.instanceId,
      role: entry.role,
      runtimeHandle: entry.runtimeHandle,
    }))),
  });
}

function mapDatasetResolutionToInstances(resolution: ResolveSystemContextDatasetsResult): ReadonlyArray<Readonly<Record<string, unknown>>> {
  return Object.freeze(resolution.resolved.map((reference) => Object.freeze({
    instanceId: reference.instanceId,
    purpose: reference.role,
    datasetAssetId: reference.datasetAssetId,
    datasetVersionId: reference.datasetVersionId,
    systemId: reference.systemAssetId,
    schema: {
      recordValueType: inferRecordValueType(reference.sampleRecordValue),
    },
    records: reference.sampleRecords,
    runtimeHandle: reference.runtimeHandle,
  })));
}

function mapDatasetResolutionToSystemRefs(resolution: ResolveSystemContextDatasetsResult): ReadonlyArray<Readonly<Record<string, unknown>>> {
  return Object.freeze(resolution.resolved
    .filter((reference) => reference.role !== "active-input")
    .map((reference) => Object.freeze({
      instanceId: reference.instanceId,
      role: reference.role,
      datasetAssetId: reference.datasetAssetId,
      systemAssetId: reference.systemAssetId,
      runtimeHandle: reference.runtimeHandle,
    })));
}

function mapSelectedImageSummary(context: SystemContextContract): Readonly<Record<string, unknown>> | undefined {
  const selectedImage = context.selectedImages[0];
  if (!selectedImage) {
    return undefined;
  }
  return Object.freeze({
    selectionId: selectedImage.selectionId,
    imageId: selectedImage.imageId,
    assetRef: selectedImage.assetRef,
    ...(asRecord(selectedImage.metadata) ? { metadata: selectedImage.metadata } : {}),
  });
}

function mapRuntimeContext(runtime: SystemContextContract["runtime"]): Readonly<Record<string, unknown>> | undefined {
  if (!runtime.runtimeSessionId && !runtime.workflowRunId && !runtime.selectorSessionId) {
    return undefined;
  }
  return Object.freeze({
    runtimeSessionId: runtime.runtimeSessionId,
    workflowRunId: runtime.workflowRunId,
    selectorSessionId: runtime.selectorSessionId,
  });
}

export function createDefaultWorkflowSystemContextBindingAdapter(
  options: CreateWorkflowSystemContextBindingAdapterOptions = {},
): WorkflowSystemContextBindingAdapter {
  const datasetReferenceResolver = options.datasetReferenceResolver ?? createDefaultSystemContextDatasetReferenceResolver();
  const mappingConfiguration = options.mappingConfiguration
    ? createSystemContextWorkflowMappingConfiguration(options.mappingConfiguration)
    : DefaultSystemContextWorkflowMappingConfiguration;

  return Object.freeze({
    map: (context) => {
      const datasetResolution = datasetReferenceResolver.resolve({ datasets: context.datasets });
      const sourceRoots: Record<SystemContextWorkflowMappingSourceRoot, unknown> = {
        [SystemContextWorkflowMappingSourceRoots.systemContext]: context,
        [SystemContextWorkflowMappingSourceRoots.parameters]: context.parameters,
        [SystemContextWorkflowMappingSourceRoots.selectedImage]: mapSelectedImageSummary(context),
        [SystemContextWorkflowMappingSourceRoots.selectedImages]: context.selectedImages,
        [SystemContextWorkflowMappingSourceRoots.datasets]: context.datasets,
        [SystemContextWorkflowMappingSourceRoots.runtime]: context.runtime,
        [SystemContextWorkflowMappingSourceRoots.datasetResolution]: datasetResolution,
      };

      const mappingTransformers: Readonly<Record<string, (value: unknown, mappingContext: {
        readonly systemContext: SystemContextContract;
        readonly datasetResolution: ResolveSystemContextDatasetsResult;
        readonly sourceRoot: SystemContextWorkflowMappingSourceRoot;
        readonly mapping: SystemContextWorkflowMappingEntry;
      }) => unknown>> = Object.freeze({
        "selected-image-summary": () => sourceRoots[SystemContextWorkflowMappingSourceRoots.selectedImage],
        "dataset-instances": () => mapDatasetResolutionToInstances(datasetResolution),
        "dataset-runtime-handles": () => Object.freeze(datasetResolution.resolved.map((reference) => reference.runtimeHandle)),
        "system-dataset-instance-refs": () => mapDatasetResolutionToSystemRefs(datasetResolution),
        "dataset-resolution-metadata": () => mapDatasetResolutionToMetadata(datasetResolution),
        "runtime-context": () => mapRuntimeContext(context.runtime),
        ...(options.valueTransformers ?? {}),
      });

      const inputValues: Record<string, unknown> = {};
      const metadata: Record<string, unknown> = {};
      const mappingIssues: SystemContextWorkflowMappingIssue[] = [];
      const appliedMappings: Array<{ mappingId: string; targetKind: string; targetPath: string }> = [];

      for (const mapping of mappingConfiguration.mappings) {
        const rootValue = sourceRoots[mapping.sourceRoot];
        let mappedValue = readByPath(rootValue, mapping.sourcePath);

        if (mapping.transformId) {
          const transformer = mappingTransformers[mapping.transformId];
          if (!transformer) {
            mappingIssues.push(Object.freeze({
              mappingId: mapping.mappingId,
              code: "transformer-missing",
              message: `No workflow mapping value transformer '${mapping.transformId}' was registered.`,
            }));
            continue;
          }
          mappedValue = transformer(mappedValue, {
            systemContext: context,
            datasetResolution,
            sourceRoot: mapping.sourceRoot,
            mapping,
          });
        }

        if (mappedValue === undefined) {
          mappedValue = mapping.defaultValue;
        }

        if (mappedValue === undefined) {
          if (mapping.required) {
            mappingIssues.push(Object.freeze({
              mappingId: mapping.mappingId,
              code: "source-value-missing",
              message: `Workflow mapping '${mapping.mappingId}' did not resolve a value.`,
            }));
          }
          continue;
        }

        const target = mapping.targetKind === SystemContextWorkflowMappingTargetKinds.workflowInput ? inputValues : metadata;
        setByPath(target, mapping.targetPath, mappedValue);
        appliedMappings.push({ mappingId: mapping.mappingId, targetKind: mapping.targetKind, targetPath: mapping.targetPath ?? "" });
      }

      metadata.systemContextMapping = Object.freeze({
        contractVersion: mappingConfiguration.contractVersion,
        appliedMappings: Object.freeze(appliedMappings.map((entry) => Object.freeze({ ...entry }))),
        issues: Object.freeze(mappingIssues.map((entry) => Object.freeze({ ...entry }))),
      });

      return Object.freeze({
        inputValues: Object.freeze(inputValues),
        metadata: Object.freeze(metadata),
      });
    },
  });
}

