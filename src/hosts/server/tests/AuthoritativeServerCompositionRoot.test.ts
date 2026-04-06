import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  createHostRuntimeIdentity,
} from "../../../domain/hosts/HostRuntimeDomain";
import {
  HostCompositionContractError,
  createHostBootConfiguration,
} from "../../../application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerCompositionRoot } from "../AuthoritativeServerCompositionRoot";

describe("AuthoritativeServerCompositionRoot", () => {
  it("composes and stops authoritative server runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 4100,
        address: "127.0.0.1:4100",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.port).toBe(4100);
    expect(runtime.phase).toBe("ready");
    expect(runtime.transitionHistory.map((entry) => entry.to)).toEqual([
      "composing",
      "starting",
      "ready",
    ]);

    await runtime.stop();
    expect(closed).toBeTrue();
    expect(runtime.phase).toBe("stopped");
  });

  it("rejects non-authoritative hosts for authoritative composition root", async () => {
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonAuthoritativeHost = createHostRuntimeIdentity({
      hostId: "host:worker:runtime",
      kind: HostRuntimeKinds.worker,
      controlPlaneRole: HostControlPlaneRoles.none,
      capabilities: [
        HostCapabilityFlags.workerRuntime,
        HostCapabilityFlags.nodeExecution,
      ],
      responsibilities: [
        "execute workloads",
      ],
      startupDependencies: AuthoritativeServerHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonAuthoritativeHost,
      mode: "cold-start",
      startupReason: "invalid-authority-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });
});

