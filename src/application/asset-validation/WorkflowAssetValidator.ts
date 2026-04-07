import {
  AssetValidationLayers,
  AssetValidationSeverities,
  createAssetValidationResult,
  type AssetValidationIssue,
  type AssetValidationResult,
} from "@domain/contracts/AssetValidation";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import { ValidatedAssetTypes, type AssetValidator, type ValidatedAssetRef } from "./AssetValidationTypes";

export class WorkflowAssetValidator implements AssetValidator {
  public readonly assetType = ValidatedAssetTypes.workflow;

  public constructor(private readonly assetCatalog: Pick<IAssetCatalog, "getById">) {}

  public async validate(asset: ValidatedAssetRef): Promise<AssetValidationResult> {
    const issues: AssetValidationIssue[] = [];
    const resolved = await this.assetCatalog.getById(asset.assetId.trim());
    if (!resolved) {
      issues.push({
        code: "workflow.missing",
        message: `Workflow asset '${asset.assetId}' is missing.`,
        severity: AssetValidationSeverities.error,
        layer: AssetValidationLayers.referential,
        assetId: asset.assetId,
        assetType: this.assetType,
      });
      return createAssetValidationResult({ errors: issues });
    }

    if (resolved.kind !== "workflow-definition") {
      issues.push({
        code: "workflow.invalid-kind",
        message: `Asset '${asset.assetId}' resolved as '${resolved.kind}' instead of workflow-definition.`,
        severity: AssetValidationSeverities.error,
        layer: AssetValidationLayers.structural,
        assetId: asset.assetId,
        assetType: this.assetType,
      });
    }

    return createAssetValidationResult({ errors: issues });
  }
}

