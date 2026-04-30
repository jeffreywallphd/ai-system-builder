import type {
  RuntimeInstallRequest,
  RuntimeInstallResult,
  RuntimeInstallStatusResult,
} from "../../../contracts/runtime-installer";

export interface RuntimeInstallerPort {
  getInstallStatus(targetId: string): Promise<RuntimeInstallStatusResult>;
  ensureInstalled(request: RuntimeInstallRequest): Promise<RuntimeInstallResult>;
  repairInstall?(request: RuntimeInstallRequest): Promise<RuntimeInstallResult>;
}
