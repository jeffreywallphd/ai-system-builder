import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ComfyRuntimeInstallationAsset } from "../../../application/runtime/ComfyRuntimeInstallationAsset";
import { ComfyRuntimeWorkflowProfiles } from "../../../application/runtime/ComfyRuntimeRequirements";
import type { ComfyRuntimeOrchestrationContext } from "../../../application/runtime/ComfyRuntimeInstallerOrchestrationService";
import { ComfyRuntimeAssetValidationHook } from "../ComfyRuntimeAssetValidationHook";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "comfy-runtime-asset-validation-"));
});

afterEach(() => {
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("ComfyRuntimeAssetValidationHook", () => {
  it("reports missing required assets for default workflow profile", async () => {
    const hook = new ComfyRuntimeAssetValidationHook();
    const context = createContext({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
      installDirectory: tempRoot,
    });

    const result = await hook.validateModels(context);

    expect(result.status).toBe("failed");
    const metadata = result.metadata?.modelValidation as {
      result: { valid: boolean; summary: { missingRequired: number } };
    };
    expect(metadata.result.valid).toBeFalse();
    expect(metadata.result.summary.missingRequired).toBeGreaterThan(0);
    expect(result.issues.some((entry) => entry.code === "runtime-asset-missing")).toBeTrue();
  });

  it("distinguishes incompatible assets by extension", async () => {
    mkdirSync(path.join(tempRoot, "models", "checkpoints"), { recursive: true });
    mkdirSync(path.join(tempRoot, "models", "vae"), { recursive: true });
    writeFileSync(path.join(tempRoot, "models", "checkpoints", "model.txt"), "bad", "utf8");
    writeFileSync(path.join(tempRoot, "models", "vae", "vae.invalid"), "bad", "utf8");

    const hook = new ComfyRuntimeAssetValidationHook();
    const result = await hook.validateModels(createContext({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
      installDirectory: tempRoot,
    }));
    const metadata = result.metadata?.modelValidation as {
      result: {
        entries: ReadonlyArray<{ requirementId: string; status: string }>;
      };
    };
    expect(metadata.result.entries.some((entry) => entry.status === "incompatible")).toBeTrue();
  });

  it("returns unknown-unverifiable for limited compatibility checks", async () => {
    mkdirSync(path.join(tempRoot, "models", "checkpoints"), { recursive: true });
    mkdirSync(path.join(tempRoot, "models", "vae"), { recursive: true });
    writeFileSync(path.join(tempRoot, "models", "checkpoints", "base.safetensors"), "ok", "utf8");
    writeFileSync(path.join(tempRoot, "models", "vae", "detail.safetensors"), "ok", "utf8");

    const hook = new ComfyRuntimeAssetValidationHook();
    const result = await hook.validateModels(createContext({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
      installDirectory: tempRoot,
    }));
    const metadata = result.metadata?.modelValidation as {
      result: {
        entries: ReadonlyArray<{ requirementId: string; status: string }>;
        summary: { unknownUnverifiable: number };
      };
    };

    expect(metadata.result.entries.some((entry) => entry.requirementId === "checkpoint-default" && entry.status === "unknown-unverifiable")).toBeTrue();
    expect(metadata.result.summary.unknownUnverifiable).toBeGreaterThan(0);
  });

  it("validates FaceID requirements when FaceID profile is selected", async () => {
    mkdirSync(path.join(tempRoot, "models", "checkpoints"), { recursive: true });
    mkdirSync(path.join(tempRoot, "models", "vae"), { recursive: true });
    mkdirSync(path.join(tempRoot, "models", "insightface"), { recursive: true });
    writeFileSync(path.join(tempRoot, "models", "checkpoints", "base.safetensors"), "ok", "utf8");
    writeFileSync(path.join(tempRoot, "models", "vae", "detail.safetensors"), "ok", "utf8");
    writeFileSync(path.join(tempRoot, "models", "insightface", "model.onnx"), "ok", "utf8");

    const hook = new ComfyRuntimeAssetValidationHook();
    const result = await hook.validateModels(createContext({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
      installDirectory: tempRoot,
    }));
    const metadata = result.metadata?.modelValidation as {
      result: {
        entries: ReadonlyArray<{ requirementId: string; status: string }>;
      };
    };
    expect(metadata.result.entries.some((entry) => entry.requirementId === "faceid-model")).toBeTrue();
  });

  it("distinguishes missing optional assets explicitly", async () => {
    mkdirSync(path.join(tempRoot, "models", "checkpoints"), { recursive: true });
    mkdirSync(path.join(tempRoot, "models", "vae"), { recursive: true });
    writeFileSync(path.join(tempRoot, "models", "checkpoints", "base.safetensors"), "ok", "utf8");
    writeFileSync(path.join(tempRoot, "models", "vae", "detail.safetensors"), "ok", "utf8");

    const hook = new ComfyRuntimeAssetValidationHook();
    const runtimeAsset = {
      ...ComfyRuntimeInstallationAsset,
      runtimeAssetRequirements: [
        ...ComfyRuntimeInstallationAsset.runtimeAssetRequirements,
        {
          requirementId: "optional-lora",
          kind: "lora" as const,
          displayName: "Optional Lora",
          applicability: "always" as const,
          required: false,
          directoryRelativePath: "models/loras",
          configuredModelName: "system-default",
          candidateFileNames: [],
          allowedExtensions: [".safetensors"],
          minimumFileCount: 1,
          compatibilityCheck: "filename-or-any" as const,
          metadata: {},
        },
      ],
    };
    const result = await hook.validateModels(createContext({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
      installDirectory: tempRoot,
      runtimeAsset,
    }));
    const metadata = result.metadata?.modelValidation as {
      result: {
        entries: ReadonlyArray<{ requirementId: string; status: string }>;
      };
    };
    expect(metadata.result.entries.some((entry) => entry.requirementId === "optional-lora" && entry.status === "missing-optional")).toBeTrue();
  });
});

function createContext(input: {
  readonly workflowProfile: (typeof ComfyRuntimeWorkflowProfiles)[keyof typeof ComfyRuntimeWorkflowProfiles];
  readonly installDirectory: string;
  readonly runtimeAsset?: typeof ComfyRuntimeInstallationAsset;
}): ComfyRuntimeOrchestrationContext {
  return Object.freeze({
    runtimeAsset: input.runtimeAsset ?? ComfyRuntimeInstallationAsset,
    installDirectory: input.installDirectory,
    runtimeWorkingDirectory: input.installDirectory,
    runtimeEndpoint: "http://127.0.0.1:8188",
    workflowProfile: input.workflowProfile,
  });
}
