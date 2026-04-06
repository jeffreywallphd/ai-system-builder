import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  assertHostCanRunAsControlPlane,
  transitionHostLifecyclePhase,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../HostRuntimeCatalog";
import {
  startIdentityServerHost,
  type IdentityServerHost,
  type IdentityServerHostOptions,
} from "../../../hosts/server/IdentityServerHost";

export interface AuthoritativeServerHostRuntimeHandle extends HostRuntimeHandle {
  readonly port: number;
  readonly address: string;
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
}

export interface AuthoritativeServerCompositionRootOptions {
  readonly hostOptions: IdentityServerHostOptions;
  readonly startHost?: (options: IdentityServerHostOptions) => Promise<IdentityServerHost>;
}

export function createAuthoritativeServerCompositionRoot(
  input: AuthoritativeServerCompositionRootOptions,
): ExecutableHostCompositionRoot<AuthoritativeServerHostRuntimeHandle> {
  const startHost = input.startHost ?? startIdentityServerHost;

  return Object.freeze({
    compositionRootId: "composition-root:host:server:authoritative",
    host: AuthoritativeServerHostRuntime,
    dependencyBoundary: AuthoritativeServerHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<AuthoritativeServerHostRuntimeHandle> {
      assertHostCanRunAsControlPlane(boot);
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:server:authoritative",
        host: AuthoritativeServerHostRuntime,
        dependencyBoundary: AuthoritativeServerHostRuntime.startupDependencies,
      }, boot);

      let phase = HostLifecyclePhases.configured;
      const transitionHistory: HostLifecycleTransition[] = [];
      const recordTransition = (to: typeof HostLifecyclePhases[keyof typeof HostLifecyclePhases], reason: string) => {
        const transition = transitionHostLifecyclePhase({
          hostId: boot.host.hostId,
          from: phase,
          to,
          occurredAt: boot.startedAt,
          reason,
        });
        transitionHistory.push(transition);
        phase = to;
      };

      recordTransition(HostLifecyclePhases.composing, "compose-authoritative-server-host");
      recordTransition(HostLifecyclePhases.starting, "start-authoritative-server-host");

      try {
        const startedHost = await startHost(input.hostOptions);
        recordTransition(HostLifecyclePhases.ready, "authoritative-server-ready");

        const stop = async () => {
          if (phase === HostLifecyclePhases.stopped || phase === HostLifecyclePhases.failed) {
            return;
          }
          recordTransition(HostLifecyclePhases.stopping, "authoritative-server-stop-requested");
          await startedHost.close();
          recordTransition(HostLifecyclePhases.stopped, "authoritative-server-stopped");
        };

        return Object.freeze({
          host: boot.host,
          get phase() {
            return phase;
          },
          port: startedHost.port,
          address: startedHost.address,
          get transitionHistory() {
            return Object.freeze([...transitionHistory]);
          },
          stop,
        });
      } catch (error) {
        if (phase !== HostLifecyclePhases.failed && phase !== HostLifecyclePhases.stopped) {
          const failedTransition = transitionHostLifecyclePhase({
            hostId: boot.host.hostId,
            from: phase,
            to: HostLifecyclePhases.failed,
            occurredAt: boot.startedAt,
            reason: "authoritative-server-start-failed",
          });
          transitionHistory.push(failedTransition);
          phase = HostLifecyclePhases.failed;
        }
        throw error;
      }
    },
  });
}
