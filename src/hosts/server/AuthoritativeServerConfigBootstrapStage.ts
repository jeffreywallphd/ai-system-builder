import { resolveHostStartupConfiguration } from "@infrastructure/config/HostStartupConfiguration";
import { advertiseHostRuntimeMetadata } from "../HostRuntimeMetadataCatalog";
import { createStartupTracer, type StartupTracer } from "../bootstrap/startupTracer";
import {
  AuthoritativeServerBootstrapStageIds,
  type AuthoritativeServerConfigBootstrapStage,
  type AuthoritativeServerConfigStageInput,
  type AuthoritativeServerConfigStageOutput,
} from "./AuthoritativeServerBootstrapStageContracts";

interface AuthoritativeServerStartupConfigurationInput {
  readonly deploymentProfile?: {
    readonly profileId?: string;
    readonly environmentName?: string;
    readonly releaseChannel?: string;
    readonly region?: string;
    readonly metadata?: Readonly<Record<string, string | undefined>>;
  };
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly enabledCapabilities?: ReadonlyArray<AuthoritativeServerConfigStageOutput["enabledCapabilities"][number]>;
}

export interface AuthoritativeServerConfigBootstrapStageOptions {
  readonly startup?: {
    readonly deploymentProfile?: {
      readonly profileId?: string;
      readonly environmentName?: string;
      readonly releaseChannel?: string;
      readonly region?: string;
      readonly metadata?: Readonly<Record<string, string | undefined>>;
    };
    readonly enabledCapabilities?: ReadonlyArray<AuthoritativeServerConfigStageOutput["enabledCapabilities"][number]>;
  };
  readonly resolveStartupConfiguration?: (input: {
    readonly boot: AuthoritativeServerConfigStageInput["boot"];
    readonly startup: AuthoritativeServerStartupConfigurationInput;
  }) => {
    readonly deploymentProfile: AuthoritativeServerConfigStageOutput["deploymentProfile"];
    readonly environment: AuthoritativeServerConfigStageOutput["environment"];
    readonly enabledCapabilities: AuthoritativeServerConfigStageOutput["enabledCapabilities"];
  };
  readonly createStartupTracer?: (input: {
    readonly boot: AuthoritativeServerConfigStageInput["boot"];
    readonly hostConfiguration: AuthoritativeServerConfigStageInput["hostConfiguration"];
  }) => StartupTracer;
}

export function createAuthoritativeServerConfigBootstrapStage(
  options?: AuthoritativeServerConfigBootstrapStageOptions,
): AuthoritativeServerConfigBootstrapStage {
  return Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.config,
    description: "Resolve startup configuration, host runtime metadata, and startup tracer.",
    async execute(input: AuthoritativeServerConfigStageInput): Promise<AuthoritativeServerConfigStageOutput> {
      const startupTracer = (
        options?.createStartupTracer
        ?? ((tracerInput) => createStartupTracer({
          startupReason: tracerInput.boot.startupReason,
        }))
      )({
        boot: input.boot,
        hostConfiguration: input.hostConfiguration,
      });
      const configSpan = startupTracer.startSpan("config-load", {
        metadata: Object.freeze({
          component: "authoritative-server-composition-root",
        }),
      });
      let startupConfiguration: {
        readonly deploymentProfile: AuthoritativeServerConfigStageOutput["deploymentProfile"];
        readonly environment: AuthoritativeServerConfigStageOutput["environment"];
        readonly enabledCapabilities: AuthoritativeServerConfigStageOutput["enabledCapabilities"];
      };
      try {
        startupConfiguration = await Promise.resolve((
          options?.resolveStartupConfiguration
          ?? ((resolverInput) => resolveHostStartupConfiguration(resolverInput))
        )({
          boot: input.boot,
          startup: {
            deploymentProfile: options?.startup?.deploymentProfile,
            environment: input.environment,
            enabledCapabilities: options?.startup?.enabledCapabilities,
          },
        }));
        configSpan.complete();
      } catch (error) {
        configSpan.fail(error);
        throw error;
      }
      const runtimeMetadata = advertiseHostRuntimeMetadata({
        host: input.boot.host,
        metadata: Object.freeze({
          compositionRootId: "composition-root:host:server:authoritative",
          startupReason: input.startupReason,
          controlPlaneSource: "local-authoritative-server",
          transportHost: input.hostConfiguration.host,
          transportPort: input.hostConfiguration.port !== undefined ? String(input.hostConfiguration.port) : undefined,
        }),
      });

      return Object.freeze({
        deploymentProfile: startupConfiguration.deploymentProfile,
        environment: startupConfiguration.environment,
        enabledCapabilities: startupConfiguration.enabledCapabilities,
        runtimeMetadata,
        startupTracer,
      });
    },
  });
}
