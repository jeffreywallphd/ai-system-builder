import process from "node:process";
import {
  HostBootModes,
  createHostBootConfiguration,
  type HostBootConfiguration,
  type HostBootMode,
} from "../../application/common/HostCompositionContracts";
import { DesktopHostRuntime } from "../HostRuntimeCatalog";
import {
  createDesktopCompositionRoot,
  type DesktopCompositionRootOptions,
  type DesktopHostRuntimeHandle,
} from "./DesktopHostCompositionRoot";

export interface DesktopHostEntrypointBootOptions {
  readonly mode?: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}

export interface DesktopHostEntrypointOptions {
  readonly hostOptions?: DesktopCompositionRootOptions["hostOptions"];
  readonly startHost: DesktopCompositionRootOptions["startHost"];
  readonly bootstrap?: DesktopCompositionRootOptions["bootstrap"];
  readonly boot?: DesktopHostEntrypointBootOptions;
}

export interface ConstructedDesktopHostAssembly {
  readonly compositionRoot: ReturnType<typeof createDesktopCompositionRoot>;
  readonly boot: HostBootConfiguration;
}

const DefaultStartupReason = "desktop-host-entrypoint-startup";

function resolveDefaultRequiredDependencyIds(): ReadonlyArray<string> {
  return Object.freeze(DesktopHostRuntime.startupDependencies.map((dependency) => dependency.dependencyId));
}

export function createDesktopHostBootConfiguration(
  options?: DesktopHostEntrypointBootOptions,
): HostBootConfiguration {
  return createHostBootConfiguration({
    host: DesktopHostRuntime,
    mode: options?.mode ?? HostBootModes.coldStart,
    startedAt: options?.startedAt,
    startupReason: options?.startupReason ?? DefaultStartupReason,
    environment: options?.environment ?? process.env,
    requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds(),
  });
}

export function constructDesktopHostAssembly(
  options: DesktopHostEntrypointOptions,
): ConstructedDesktopHostAssembly {
  const compositionRoot = createDesktopCompositionRoot({
    hostOptions: options.hostOptions,
    startHost: options.startHost,
    bootstrap: options.bootstrap,
  });
  const boot = createDesktopHostBootConfiguration(options.boot);

  return Object.freeze({
    compositionRoot,
    boot,
  });
}

export async function startDesktopHostAssembly(
  options: DesktopHostEntrypointOptions,
): Promise<DesktopHostRuntimeHandle> {
  const assembly = constructDesktopHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}
