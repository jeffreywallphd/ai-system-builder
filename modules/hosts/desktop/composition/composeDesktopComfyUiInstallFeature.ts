import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import type { LoggingPort } from "../../../application/ports/logging";
import type { RuntimeInstallerPort } from "../../../application/ports/runtime-installer";
import type { RuntimeInstallRequest } from "../../../contracts/runtime-installer";
import type { DesktopComfyUiInstallStatusRequest, DesktopComfyUiRepairInstallRequest } from "../../../contracts/ipc";
import { createComfyUiRuntimeInstaller } from "../../../adapters/runtime/installer/comfyui/createComfyUiRuntimeInstaller";
import { createGitRuntimeInstallerAdapter } from "../../../adapters/runtime/installer/git/createGitRuntimeInstallerAdapter";
import {
  resolveComfyUiInstallRoot,
  resolveComfyUiPythonEnvironmentMode,
} from "./composeDesktopComfyUiHelpers";

const execFile = promisify(nodeExecFile);
const COMFYUI_INSTALL_COMMAND_TIMEOUT_MS_DEFAULT = 30 * 60 * 1000;
const DEFAULT_COMFYUI_REPOSITORY_URL = "https://github.com/Comfy-Org/ComfyUI";

export interface DesktopComfyUiRuntimeIpcFeature {
  readInstallStatus: (request: DesktopComfyUiInstallStatusRequest) => Promise<Awaited<ReturnType<RuntimeInstallerPort["getInstallStatus"]>>>;
  repairInstall: (request: DesktopComfyUiRepairInstallRequest) => Promise<Awaited<ReturnType<RuntimeInstallerPort["ensureInstalled"]>>>;
}

export interface ComposeDesktopComfyUiInstallFeatureOptions {
  runtimeRootDirectory?: string;
  loggingPort: LoggingPort;
}

function buildHostComfyUiInstallRequest(input: {
  installRoot: string;
  allowUpdate?: boolean;
  forceRepair?: boolean;
}): RuntimeInstallRequest {
  return {
    targetId: "comfyui",
    installRoot: input.installRoot,
    source: {
      type: "git",
      repositoryUrl: DEFAULT_COMFYUI_REPOSITORY_URL,
      ref: undefined,
    },
    allowUpdate: input.allowUpdate,
    forceRepair: input.forceRepair,
  };
}

export function composeDesktopComfyUiInstallFeature(options: ComposeDesktopComfyUiInstallFeatureOptions): DesktopComfyUiRuntimeIpcFeature {
  let installerPromise: Promise<RuntimeInstallerPort> | undefined;
  const resolveInstallRoot = (requestInstallRoot: string | undefined): string => requestInstallRoot ?? resolveComfyUiInstallRoot(process.env, options.runtimeRootDirectory);
  const getInstaller = async (): Promise<RuntimeInstallerPort> => {
    if (!installerPromise) {
      installerPromise = (async () => {
        const comfyUiBasePythonCommand = process.env.COMFYUI_PYTHON_COMMAND ?? process.env.PYTHON_RUNTIME_COMMAND ?? (process.platform === "win32" ? "python" : "python3");
        const configuredComfyUiInstallCommandTimeoutMs = Number(process.env.COMFYUI_INSTALL_COMMAND_TIMEOUT_MS);
        const comfyUiInstallCommandTimeoutMs = Number.isFinite(configuredComfyUiInstallCommandTimeoutMs) && configuredComfyUiInstallCommandTimeoutMs > 0
          ? configuredComfyUiInstallCommandTimeoutMs
          : COMFYUI_INSTALL_COMMAND_TIMEOUT_MS_DEFAULT;
        return createComfyUiRuntimeInstaller({
          gitInstaller: createGitRuntimeInstallerAdapter(),
          pythonCommand: comfyUiBasePythonCommand,
          execFile: (file, args = []) => execFile(file, [...args], { timeout: comfyUiInstallCommandTimeoutMs, windowsHide: true }),
          pythonEnvironmentMode: resolveComfyUiPythonEnvironmentMode(process.env),
          skipPythonSetup: process.env.COMFYUI_SKIP_PYTHON_SETUP === "1",
          directMlTorchVersion: process.env.COMFYUI_DIRECTML_TORCH_VERSION,
          directMlTorchVisionVersion: process.env.COMFYUI_DIRECTML_TORCHVISION_VERSION,
          directMlPackageName: process.env.COMFYUI_DIRECTML_PACKAGE,
          logging: options.loggingPort,
        });
      })();
    }
    return installerPromise;
  };

  return {
    async readInstallStatus(request) {
      const installer = await getInstaller();
      return installer.getInstallStatus({ targetId: "comfyui", installRoot: resolveInstallRoot(request.payload.installRoot) });
    },
    async repairInstall(request) {
      const installer = await getInstaller();
      const installRequest = buildHostComfyUiInstallRequest({
        installRoot: resolveInstallRoot(request.payload.installRoot),
        allowUpdate: request.payload.allowUpdate,
        forceRepair: request.payload.forceRepair,
      });
      return installer.repairInstall?.(installRequest) ?? installer.ensureInstalled(installRequest);
    },
  };
}
