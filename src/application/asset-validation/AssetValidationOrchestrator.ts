import { AssetValidationStatuses, createAssetValidationResult, type AssetValidationIssue, type AssetValidationResult } from "../../domain/contracts/AssetValidation";
import type { WorkflowTemplateDefinition } from "../../domain/workflow-template-studio/WorkflowTemplateDomain";
import { ValidatedAssetTypes, type AssetValidator, type ValidatedAssetRef } from "./AssetValidationTypes";

export interface AggregatedAssetValidationResult {
  readonly status: "valid" | "invalid";
  readonly byAsset: Readonly<Record<string, AssetValidationResult>>;
  readonly errorsByAsset: Readonly<Record<string, ReadonlyArray<AssetValidationIssue>>>;
  readonly warningsByAsset: Readonly<Record<string, ReadonlyArray<AssetValidationIssue>>>;
}

function toKey(asset: ValidatedAssetRef): string {
  return `${asset.assetType}:${asset.assetId}:${asset.versionId ?? "latest"}`;
}

export class AssetValidationOrchestrator {
  private readonly validatorsByType: ReadonlyMap<string, AssetValidator>;

  public constructor(validators: ReadonlyArray<AssetValidator>) {
    this.validatorsByType = new Map(validators.map((entry) => [entry.assetType, entry] as const));
  }

  public async validate(asset: ValidatedAssetRef): Promise<AggregatedAssetValidationResult> {
    const queue: ValidatedAssetRef[] = [asset];
    const seen = new Set<string>();
    const byAsset = new Map<string, AssetValidationResult>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = toKey(current);
      if (seen.has(key)) continue;
      seen.add(key);

      const validator = this.validatorsByType.get(current.assetType);
      if (!validator) {
        byAsset.set(key, createAssetValidationResult({
          errors: [{
            code: "validator.missing",
            message: `No validator registered for asset type '${current.assetType}'.`,
            severity: "error",
            layer: "structural",
            assetId: current.assetId,
            assetType: current.assetType,
          }],
        }));
        continue;
      }

      const result = await validator.validate(current);
      byAsset.set(key, result);

      if (result.status === AssetValidationStatuses.invalid) {
        continue;
      }

      for (const dep of this.resolveDependencies(current)) {
        queue.push(dep);
      }
    }

    const errorsByAsset: Record<string, ReadonlyArray<AssetValidationIssue>> = {};
    const warningsByAsset: Record<string, ReadonlyArray<AssetValidationIssue>> = {};
    let overall: "valid" | "invalid" = "valid";

    for (const [key, result] of byAsset.entries()) {
      errorsByAsset[key] = Object.freeze([...result.errors]);
      warningsByAsset[key] = Object.freeze([...result.warnings]);
      if (result.status === AssetValidationStatuses.invalid) {
        overall = "invalid";
      }
    }

    return Object.freeze({
      status: overall,
      byAsset: Object.freeze(Object.fromEntries(byAsset.entries())),
      errorsByAsset: Object.freeze(errorsByAsset),
      warningsByAsset: Object.freeze(warningsByAsset),
    });
  }

  private resolveDependencies(asset: ValidatedAssetRef): ReadonlyArray<ValidatedAssetRef> {
    if (asset.assetType !== ValidatedAssetTypes.template) {
      return Object.freeze([]);
    }

    const template = asset.payload as WorkflowTemplateDefinition | undefined;
    if (!template?.composition) {
      return Object.freeze([]);
    }

    const dependencies: ValidatedAssetRef[] = [];
    for (const workflow of template.composition.workflowInterfaces) {
      dependencies.push(Object.freeze({
        assetType: ValidatedAssetTypes.workflow,
        assetId: workflow.workflowAssetId,
        versionId: workflow.workflowAssetVersionId,
      }));
    }

    for (const output of template.composition.outputBindings) {
      if (!output.targetDatasetAssetId) continue;
      dependencies.push(Object.freeze({
        assetType: ValidatedAssetTypes.dataset,
        assetId: output.targetDatasetAssetId,
        versionId: output.targetDatasetVersionId,
      }));
    }

    for (const dependency of template.workflowAssets) {
      if (dependency.role !== "dataset") continue;
      dependencies.push(Object.freeze({
        assetType: ValidatedAssetTypes.dataset,
        assetId: dependency.assetId,
        versionId: dependency.versionId,
      }));
    }

    return Object.freeze(dependencies);
  }
}
