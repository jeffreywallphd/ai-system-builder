import { describe, expect, it } from "bun:test";
import {
  createExecutionOptionCapabilityContract,
  validateExecutionOptionCapabilityContract,
} from "../ExecutionOptionCapabilityContract";

describe("ExecutionOptionCapabilityContract", () => {
  it("builds a bounded internal contract with required/defaulted/constrained options", () => {
    const contract = createExecutionOptionCapabilityContract({
      contractVersion: "1.0.0",
      sampler: {
        required: true,
        defaultValue: "euler",
        allowedValues: ["euler", "dpmpp_2m"],
      },
      steps: {
        required: true,
        defaultValue: 28,
        minimum: 1,
        maximum: 60,
      },
      seed: {
        required: true,
        defaultValue: { mode: "random" },
        allowDeterministic: true,
        allowRandom: true,
      },
      guidanceScale: {
        required: true,
        defaultValue: 6,
        minimum: 1,
        maximum: 20,
      },
      resolution: {
        required: true,
        defaultValue: { width: 1024, height: 1024 },
        minimumWidth: 512,
        minimumHeight: 512,
        maximumWidth: 2048,
        maximumHeight: 2048,
        widthStep: 64,
        heightStep: 64,
      },
      batch: {
        required: false,
        defaultValue: 1,
        minimum: 1,
        maximum: 8,
      },
      runtime: {
        required: false,
        defaultValue: { device: "auto", precision: "auto" },
        allowedDevices: ["auto", "gpu"],
        allowedPrecisions: ["auto", "fp16", "bf16"],
      },
    });

    expect(contract.sampler.required).toBe(true);
    expect(contract.steps.maximum).toBe(60);
    expect(contract.resolution.widthStep).toBe(64);
    expect(contract.runtime.allowedDevices).toEqual(["auto", "gpu"]);
  });

  it("rejects invalid constraint ranges", () => {
    expect(() => validateExecutionOptionCapabilityContract({
      sampler: {},
      steps: { minimum: 100, maximum: 10 },
      seed: {},
      guidanceScale: {},
      resolution: {},
      batch: {},
      runtime: {},
    })).toThrow();
  });
});
