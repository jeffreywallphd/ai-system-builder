import {
  getWorkflowOutputTargetDefinition,
  type WorkflowOutputTargetDefinition,
} from "../../domain/system-runtime/WorkflowOutputTargetDomain";
import type { DatasetInstance } from "../../domain/system-runtime/DatasetInstanceDomain";
import type { WorkflowOutputBindingDescriptor } from "../../domain/workflow-studio/WorkflowOutputBindingDomain";
import type { SystemDatasetInstanceService } from "../system-runtime/SystemDatasetInstanceService";

export interface ResolveWorkflowOutputBindingWritePlanRequest {
  readonly systemId: string;
  readonly bindings: ReadonlyArray<WorkflowOutputBindingDescriptor>;
  readonly datasetInstanceService: SystemDatasetInstanceService;
}

export interface WorkflowOutputWritePlanIssue {
  readonly code:
    | "unsupported-target-type"
    | "target-grouping-required"
    | "dataset-instance-not-found"
    | "dataset-instance-system-mismatch"
    | "dataset-asset-mismatch"
    | "dataset-asset-version-mismatch";
  readonly bindingId: string;
  readonly outputId: string;
  readonly message: string;
}

export interface ResolvedWorkflowOutputWritePlanItem {
  readonly bindingId: string;
  readonly outputId: string;
  readonly intent: WorkflowOutputBindingDescriptor["intent"];
  readonly writeMode: WorkflowOutputBindingDescriptor["writeMode"];
  readonly target: Readonly<{
    readonly targetType: WorkflowOutputBindingDescriptor["target"]["targetType"];
    readonly targetId: string;
    readonly datasetInstanceId: string;
    readonly datasetAssetId: string;
    readonly datasetAssetVersionId?: string;
    readonly purpose?: string;
    readonly groupBy?: string;
  }>;
  readonly targetSemantics: Readonly<{
    readonly comparisonGrouping: WorkflowOutputTargetDefinition["comparisonGrouping"];
    readonly appendBehavior: "append-only" | "upsert-preferred";
  }>;
  readonly lineage: WorkflowOutputBindingDescriptor["lineage"];
  readonly recordEnvelope: Readonly<{
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly defaultTags: ReadonlyArray<string>;
  }>;
}

export interface ResolveWorkflowOutputBindingWritePlanResult {
  readonly ready: boolean;
  readonly plan: ReadonlyArray<ResolvedWorkflowOutputWritePlanItem>;
  readonly issues: ReadonlyArray<WorkflowOutputWritePlanIssue>;
}

function createIssue(input: WorkflowOutputWritePlanIssue): WorkflowOutputWritePlanIssue {
  return Object.freeze(input);
}

function resolveTargetInstance(input: {
  readonly systemId: string;
  readonly binding: WorkflowOutputBindingDescriptor;
  readonly targetDefinition: WorkflowOutputTargetDefinition;
  readonly datasetInstanceService: SystemDatasetInstanceService;
}): Promise<DatasetInstance> {
  const explicitInstanceId = input.binding.target.datasetInstanceId?.trim();
  if (explicitInstanceId) {
    const existing = input.datasetInstanceService.getDatasetInstance({
      systemId: input.systemId,
      instanceId: explicitInstanceId,
    });
    if (!existing) {
      throw new Error("dataset-instance-not-found");
    }
    return Promise.resolve(existing);
  }

  return input.datasetInstanceService.ensureWorkflowOutputTargetInstance({
    systemId: input.systemId,
    targetType: input.binding.target.targetType,
    datasetAssetId: input.binding.target.datasetAssetId ?? input.binding.persistence.datasetAssetId,
    datasetAssetVersionId: input.binding.target.datasetAssetVersionId ?? input.binding.persistence.datasetAssetVersionId,
  });
}

export async function resolveWorkflowOutputBindingWritePlan(
  request: ResolveWorkflowOutputBindingWritePlanRequest,
): Promise<ResolveWorkflowOutputBindingWritePlanResult> {
  const issues: WorkflowOutputWritePlanIssue[] = [];
  const plan: ResolvedWorkflowOutputWritePlanItem[] = [];

  for (const binding of request.bindings) {
    const definition = getWorkflowOutputTargetDefinition(binding.target.targetType);
    if (!definition) {
      issues.push(createIssue({
        code: "unsupported-target-type",
        bindingId: binding.bindingId,
        outputId: binding.outputId,
        message: `Workflow output target type '${binding.target.targetType}' is not supported.`,
      }));
      continue;
    }

    if (definition.comparisonGrouping === "required" && !binding.target.groupBy?.trim()) {
      issues.push(createIssue({
        code: "target-grouping-required",
        bindingId: binding.bindingId,
        outputId: binding.outputId,
        message: `Workflow output binding '${binding.bindingId}' requires target grouping metadata for '${binding.target.targetType}'.`,
      }));
      continue;
    }

    try {
      const instance = await resolveTargetInstance({
        systemId: request.systemId,
        binding,
        targetDefinition: definition,
        datasetInstanceService: request.datasetInstanceService,
      });

      if (instance.systemId !== request.systemId) {
        issues.push(createIssue({
          code: "dataset-instance-system-mismatch",
          bindingId: binding.bindingId,
          outputId: binding.outputId,
          message: `Dataset instance '${instance.instanceId}' is owned by system '${instance.systemId}' not '${request.systemId}'.`,
        }));
        continue;
      }

      const requiredAssetId = binding.target.datasetAssetId ?? binding.persistence.datasetAssetId;
      if (requiredAssetId && instance.datasetAssetId !== requiredAssetId) {
        issues.push(createIssue({
          code: "dataset-asset-mismatch",
          bindingId: binding.bindingId,
          outputId: binding.outputId,
          message: `Dataset instance '${instance.instanceId}' is linked to asset '${instance.datasetAssetId}' not '${requiredAssetId}'.`,
        }));
        continue;
      }

      const requiredVersion = binding.target.datasetAssetVersionId ?? binding.persistence.datasetAssetVersionId;
      if (requiredVersion && instance.datasetAssetVersionId && instance.datasetAssetVersionId !== requiredVersion) {
        issues.push(createIssue({
          code: "dataset-asset-version-mismatch",
          bindingId: binding.bindingId,
          outputId: binding.outputId,
          message: `Dataset instance '${instance.instanceId}' is linked to version '${instance.datasetAssetVersionId}' not '${requiredVersion}'.`,
        }));
        continue;
      }

      plan.push(Object.freeze({
        bindingId: binding.bindingId,
        outputId: binding.outputId,
        intent: binding.intent,
        writeMode: binding.writeMode,
        target: Object.freeze({
          targetType: binding.target.targetType,
          targetId: binding.target.targetId,
          datasetInstanceId: instance.instanceId,
          datasetAssetId: instance.datasetAssetId,
          datasetAssetVersionId: instance.datasetAssetVersionId,
          purpose: instance.purpose,
          groupBy: binding.target.groupBy?.trim() || undefined,
        }),
        targetSemantics: Object.freeze({
          comparisonGrouping: definition.comparisonGrouping,
          appendBehavior: binding.writeMode === "append" ? "append-only" : "upsert-preferred",
        }),
        lineage: binding.lineage,
        recordEnvelope: Object.freeze({
          metadata: Object.freeze({ ...binding.target.metadata }),
          defaultTags: Object.freeze([...(new Set(binding.records.flatMap((record) => record.tags)))]),
        }),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "dataset-instance-not-found";
      const code = message.includes("dataset-instance-not-found")
        ? "dataset-instance-not-found"
        : "dataset-instance-not-found";
      issues.push(createIssue({
        code,
        bindingId: binding.bindingId,
        outputId: binding.outputId,
        message,
      }));
    }
  }

  return Object.freeze({
    ready: issues.length === 0,
    plan: Object.freeze(plan),
    issues: Object.freeze(issues),
  });
}
