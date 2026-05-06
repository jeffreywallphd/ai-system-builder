import { describe, expect, it } from "../../../../testing/node-test";

import {
  createRuntimeCapabilityStatus,
  type RuntimeCapabilityId,
  type RuntimeCapabilityStatus,
} from "../../../../contracts/runtime";
import {
  RuntimeReadinessService,
  createComfyUiRuntimeCapabilityStatusProvider,
  createDerivedRuntimeCapabilityStatusProvider,
  createPythonRuntimeCapabilityStatusProvider,
  createRuntimeInstallerCapabilityStatusProvider,
  mapComfyUiRuntimeLifecycleStateToReadinessStatus,
  mapPythonRuntimeLifecycleStateToReadinessStatus,
  mapRuntimeInstallStatusToReadinessStatus,
  type RuntimeCapabilityStatusProvider,
} from "../runtime-readiness.service";

const NOW = "2026-05-06T00:00:00.000Z";
const now = () => NOW;

describe("RuntimeReadinessService", () => {
  it("maps Python supervisor-style states into shared readiness status vocabulary", async () => {
    expect(mapPythonRuntimeLifecycleStateToReadinessStatus("stopped")).toBe("unavailable");
    expect(mapPythonRuntimeLifecycleStateToReadinessStatus("starting")).toBe("starting");
    expect(mapPythonRuntimeLifecycleStateToReadinessStatus("ready")).toBe("ready");
    expect(mapPythonRuntimeLifecycleStateToReadinessStatus("failed")).toBe("failed");

    const provider = createPythonRuntimeCapabilityStatusProvider({ readState: () => "ready", now });
    expect(await provider.getStatus()).toMatchObject({
      capabilityId: "python-runtime",
      status: "ready",
      healthy: true,
      available: true,
      updatedAt: NOW,
    });
  });

  it("maps ComfyUI supervisor-style states into shared readiness status vocabulary", async () => {
    expect(mapComfyUiRuntimeLifecycleStateToReadinessStatus("stopped")).toBe("unavailable");
    expect(mapComfyUiRuntimeLifecycleStateToReadinessStatus("starting")).toBe("starting");
    expect(mapComfyUiRuntimeLifecycleStateToReadinessStatus("ready")).toBe("ready");
    expect(mapComfyUiRuntimeLifecycleStateToReadinessStatus("unhealthy")).toBe("failed");

    const provider = createComfyUiRuntimeCapabilityStatusProvider({ readState: () => "unhealthy", now });
    expect(await provider.getStatus()).toMatchObject({
      capabilityId: "comfyui-runtime",
      status: "failed",
      reason: { category: "health" },
      recommendedActions: ["retry", "view-logs"],
      updatedAt: NOW,
    });
  });

  it("maps runtime installer-style states without treating installed as process ready", async () => {
    expect(mapRuntimeInstallStatusToReadinessStatus("not-installed")).toBe("not-installed");
    expect(mapRuntimeInstallStatusToReadinessStatus("installing")).toBe("installing");
    expect(mapRuntimeInstallStatusToReadinessStatus("checking")).toBe("installing");
    expect(mapRuntimeInstallStatusToReadinessStatus("installed")).toBe("unknown");
    expect(mapRuntimeInstallStatusToReadinessStatus("update-available")).toBe("degraded");
    expect(mapRuntimeInstallStatusToReadinessStatus("failed")).toBe("failed");
    expect(mapRuntimeInstallStatusToReadinessStatus("unknown")).toBe("unknown");

    const provider = createRuntimeInstallerCapabilityStatusProvider({
      capabilityId: "comfyui-runtime",
      readStatus: () => "installed",
      targetId: "comfyui",
      now,
    });
    expect(await provider.getStatus()).toMatchObject({
      capabilityId: "comfyui-runtime",
      status: "unknown",
      available: false,
      details: { installStatus: "installed", targetId: "comfyui" },
      reason: { category: "installation" },
      updatedAt: NOW,
    });
  });

  it("derives feature capability status from runtime dependency status without starting runtimes", async () => {
    const provider = createDerivedRuntimeCapabilityStatusProvider({
      capabilityId: "image-generation",
      dependencies: ["comfyui-runtime"],
      readDependencyStatus: () => createRuntimeCapabilityStatus({
        capabilityId: "comfyui-runtime",
        status: "starting",
        updatedAt: NOW,
      }),
      now,
    });

    expect(await provider.getStatus()).toMatchObject({
      capabilityId: "image-generation",
      status: "starting",
      available: false,
      reason: { category: "dependency" },
      dependencies: [{ capabilityId: "comfyui-runtime", status: "starting" }],
      updatedAt: NOW,
    });
  });

  it("isolates provider failures when reading an individual capability", async () => {
    const service = new RuntimeReadinessService({
      providers: [{
        capabilityId: "python-runtime",
        async getStatus() {
          throw new Error("boom");
        },
      }],
      now,
    });

    expect(await service.getCapabilityStatus("python-runtime")).toMatchObject({
      capabilityId: "python-runtime",
      status: "failed",
      available: false,
      reason: {
        code: "runtime.readiness.provider-failed",
        message: "boom",
      },
      recommendedActions: ["retry", "view-logs"],
      updatedAt: NOW,
    });
  });

  it("aggregates a full readiness snapshot across explicit providers", async () => {
    const service = new RuntimeReadinessService({
      providers: createFullProviderSet(),
      now,
    });

    const snapshot = await service.getReadinessSnapshot();

    expect(snapshot).toMatchObject({
      status: "degraded",
      healthy: false,
      available: true,
      updatedAt: NOW,
    });
    expect(snapshot.capabilities.length).toBe(7);
    expect(snapshot.capabilities.map((capability) => [capability.capabilityId, capability.status])).toEqual([
      ["python-runtime", "ready"],
      ["comfyui-runtime", "ready"],
      ["image-generation", "ready"],
      ["dataset-preparation", "ready"],
      ["model-training", "ready"],
      ["model-validation", "ready"],
      ["model-publishing", "unknown"],
    ]);
  });
});

function createFullProviderSet(): RuntimeCapabilityStatusProvider[] {
  const staticStatuses: Map<RuntimeCapabilityId, RuntimeCapabilityStatus> = new Map([
    ["python-runtime", createRuntimeCapabilityStatus({ capabilityId: "python-runtime", status: "ready", updatedAt: NOW })],
    ["comfyui-runtime", createRuntimeCapabilityStatus({ capabilityId: "comfyui-runtime", status: "ready", updatedAt: NOW })],
  ] as const);

  const readDependencyStatus = async (capabilityId: RuntimeCapabilityId) => {
    const status = staticStatuses.get(capabilityId);
    if (!status) {
      throw new Error(`Missing status for ${capabilityId}.`);
    }
    return status;
  };

  return [
    { capabilityId: "python-runtime", getStatus: () => readDependencyStatus("python-runtime") },
    { capabilityId: "comfyui-runtime", getStatus: () => readDependencyStatus("comfyui-runtime") },
    createDerivedRuntimeCapabilityStatusProvider({ capabilityId: "image-generation", dependencies: ["comfyui-runtime"], readDependencyStatus, now }),
    createDerivedRuntimeCapabilityStatusProvider({ capabilityId: "dataset-preparation", dependencies: ["python-runtime"], readDependencyStatus, now }),
    createDerivedRuntimeCapabilityStatusProvider({ capabilityId: "model-training", dependencies: ["python-runtime"], readDependencyStatus, now }),
    createDerivedRuntimeCapabilityStatusProvider({ capabilityId: "model-validation", dependencies: ["python-runtime"], readDependencyStatus, now }),
    {
      capabilityId: "model-publishing",
      getStatus: () => createRuntimeCapabilityStatus({
        capabilityId: "model-publishing",
        status: "unknown",
        summary: "Model publishing readiness is not composed yet.",
        updatedAt: NOW,
      }),
    },
  ];
}
