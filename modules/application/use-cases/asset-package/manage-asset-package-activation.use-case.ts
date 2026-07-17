import type { AssetPackageRepositoryPort } from "../../ports/asset-package";
import type {
  AssetPackageRecord,
  SetAssetPackageActivationCommand,
} from "../../../contracts/asset-package";
import type { AssetPackageResult } from "./asset-package-result";
import { packageFailure, packageSuccess } from "./asset-package-result";

export class ActivateAssetPackageUseCase {
  public constructor(private readonly packages: AssetPackageRepositoryPort, private readonly now: () => string) {}

  public async execute(command: SetAssetPackageActivationCommand): Promise<AssetPackageResult<AssetPackageRecord>> {
    const target = await this.packages.readPackage(command.workspaceId, command.recordId);
    if (!target || !["installed", "disabled", "active"].includes(target.status)) {
      return packageFailure("package-not-activatable", "Package is not available for activation.");
    }
    if (target.status === "active") return packageSuccess(target);
    const active = (await this.packages.listPackages(command.workspaceId)).find(
      (item) => item.packageId === target.packageId && item.status === "active",
    );
    const now = this.now();
    if (active) {
      await this.packages.updatePackage(
        { ...active, status: "disabled", disabledAt: now, revision: active.revision + 1, updatedAt: now },
        active.revision,
      );
    }
    return packageSuccess(
      await this.packages.updatePackage(
        {
          ...target,
          status: "active",
          activatedBy: command.actorId,
          activatedAt: now,
          previousActiveRecordId: active?.recordId,
          revision: target.revision + 1,
          updatedAt: now,
        },
        target.revision,
      ),
    );
  }
}

export class DisableAssetPackageUseCase {
  public constructor(private readonly packages: AssetPackageRepositoryPort, private readonly now: () => string) {}
  public async execute(command: SetAssetPackageActivationCommand): Promise<AssetPackageResult<AssetPackageRecord>> {
    const target = await this.packages.readPackage(command.workspaceId, command.recordId);
    if (!target) return packageFailure("package-not-found", "Package was not found.");
    if (target.status === "disabled") return packageSuccess(target);
    if (!["active", "installed"].includes(target.status)) return packageFailure("package-not-disableable", "Package cannot be disabled.");
    const now = this.now();
    return packageSuccess(await this.packages.updatePackage({ ...target, status: "disabled", disabledAt: now, revision: target.revision + 1, updatedAt: now }, target.revision));
  }
}

export class RollbackAssetPackageUseCase {
  public constructor(private readonly packages: AssetPackageRepositoryPort, private readonly activate: ActivateAssetPackageUseCase) {}
  public async execute(command: SetAssetPackageActivationCommand): Promise<AssetPackageResult<AssetPackageRecord>> {
    const current = await this.packages.readPackage(command.workspaceId, command.recordId);
    if (!current?.previousActiveRecordId) return packageFailure("package-rollback-unavailable", "No previous active package is available.");
    return this.activate.execute({ ...command, recordId: current.previousActiveRecordId });
  }
}

export class ListAssetPackagesUseCase {
  public constructor(private readonly packages: AssetPackageRepositoryPort) {}
  public execute(workspaceId: SetAssetPackageActivationCommand["workspaceId"]) {
    return this.packages.listPackages(workspaceId);
  }
}
