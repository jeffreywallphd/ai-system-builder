import { describe, expect, it } from "bun:test";
import {
  ImageManipulationFailureNormalizationSources,
  normalizeImageManipulationExecutionFailure,
} from "../ports";

describe("image manipulation failure normalization", () => {
  it("classifies missing-model backend failures as dependency failures", () => {
    const failure = normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.dispatch,
      failedAt: "2026-04-08T20:20:00.000Z",
      backendErrorCode: "prompt-rejected",
      rawMessage: "ComfyUI missing-model checkpoint not found.",
      diagnostics: Object.freeze({
        nodeErrorTypes: Object.freeze(["missing-model"]),
      }),
      stageCode: "dispatch",
      state: "failed",
    });

    expect(failure.category).toBe("dependency");
    expect(failure.code).toBe("execution-missing-model-dependency");
    expect(failure.retryable).toBeFalse();
    expect(failure.classification?.layer).toBe("node-availability");
    expect(failure.classification?.kind).toBe("operational");
    expect(failure.classification?.disposition).toBe("terminal");
    expect(failure.classification?.resolutionActor).toBe("operator");
    expect(failure.recovery?.recoveryAction.kind).toBe("terminal-not-retryable");
    expect(failure.recovery?.escalation.category).toBe("operator");
  });

  it("classifies graph binding mismatches as translation failures", () => {
    const failure = normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.dispatch,
      failedAt: "2026-04-08T20:20:30.000Z",
      rawMessage: "ComfyUI dispatch payload is missing the translated request at inputs.parameters['comfy.request'].",
      stageCode: "dispatch",
      state: "failed",
    });

    expect(failure.category).toBe("translation");
    expect(failure.code).toBe("dispatch-translation-mismatch");
    expect(failure.userMessage).toContain("could not be prepared");
    expect(failure.classification?.layer).toBe("execution-dispatch");
    expect(failure.classification?.kind).toBe("validation");
    expect(failure.classification?.userFixable).toBeTrue();
    expect(failure.classification?.issueCode).toBe("im.dispatch.validation.dispatch-translation-mismatch");
  });

  it("classifies output collection anomalies as output failures with partial output context", () => {
    const failure = normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.outputCollection,
      failedAt: "2026-04-08T20:21:00.000Z",
      rawMessage: "Output collection failed while persisting preview asset.",
      partialOutputCount: 2,
      partialProgressObserved: true,
      state: "failed",
    });

    expect(failure.category).toBe("output");
    expect(failure.code).toBe("output-collection-partial-anomaly");
    expect(failure.retryable).toBeTrue();
    expect(failure.recovery?.retry.retryMode).toBe("automatic");
    expect(failure.partialOutputCount).toBe(2);
    expect(failure.classification?.layer).toBe("result-collection");
    expect(failure.classification?.disposition).toBe("retryable");
    expect(failure.classification?.degraded).toBeTrue();
  });

  it("redacts local filesystem and token details from diagnostics", () => {
    const failure = normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.progressPolling,
      failedAt: "2026-04-08T20:21:30.000Z",
      rawMessage: "error reading C:\\models\\secret.ckpt token=abc123",
      diagnostics: Object.freeze({
        path: "/var/comfy/models/private/model.ckpt",
        auth: "authorization=Bearer xyz",
      }),
      state: "failed",
    });

    expect(failure.diagnostics?.rawMessage).toContain("[redacted-path]");
    const details = failure.diagnostics?.details as Readonly<Record<string, unknown>>;
    expect(String(details.path)).toContain("[redacted-path]");
    expect(String(details.auth)).toContain("[redacted]");
  });

  it("applies retry-after hints for timeout failures", () => {
    const failure = normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.progressPolling,
      failedAt: "2026-04-08T20:22:00.000Z",
      rawMessage: "Request timeout while waiting for backend progress polling.",
      state: "failed",
    });

    expect(failure.category).toBe("timeout");
    expect(failure.retryable).toBeTrue();
    expect(failure.recovery?.retry.retryAfterMs).toBe(5000);
    expect(failure.recovery?.recoveryAction.kind).toBe("retry-automatic");
  });
});
