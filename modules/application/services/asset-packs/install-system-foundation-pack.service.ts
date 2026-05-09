import type { AssetPackId } from "../../../contracts/asset";
import { SYSTEM_FOUNDATION_PACK_ID, SYSTEM_FOUNDATION_PACK_MANIFEST } from "./system-packs";
import {
  InstallSystemAssetPackService,
  type InstallSystemAssetPackInput,
  type InstallSystemAssetPackResult,
  type InstallSystemAssetPackServiceDependencies,
} from "./install-system-asset-pack.service";

export type InstallSystemFoundationPackInput = Omit<
  InstallSystemAssetPackInput,
  "manifest" | "expectedPackId"
>;

export class InstallSystemFoundationPackService {
  private readonly installer: InstallSystemAssetPackService;

  public constructor(dependencies: InstallSystemAssetPackServiceDependencies) {
    this.installer = new InstallSystemAssetPackService(dependencies);
  }

  public install(
    input: InstallSystemFoundationPackInput = {},
  ): Promise<InstallSystemAssetPackResult> {
    return this.installer.install({
      ...input,
      manifest: SYSTEM_FOUNDATION_PACK_MANIFEST,
      expectedPackId: SYSTEM_FOUNDATION_PACK_ID as AssetPackId,
    });
  }
}

export function installSystemFoundationPack(
  dependencies: InstallSystemAssetPackServiceDependencies,
  input: InstallSystemFoundationPackInput = {},
): Promise<InstallSystemAssetPackResult> {
  return new InstallSystemFoundationPackService(dependencies).install(input);
}
