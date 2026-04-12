import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  DEFAULT_APPROVED_RUN_PARAMETER_DEFINITIONS,
  OperationalApprovedRunLaunchPanel,
  mapRuntimeStartResponseToSubmissionState,
  validateOperationalApprovedRunLaunchDraft,
} from "../operations";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("OperationalApprovedRunLaunchPanel", () => {
  it("validates approved launch drafts and enforces allowed parameter bounds", () => {
    const invalid = validateOperationalApprovedRunLaunchDraft({
      systemId: "   ",
      versionId: "",
      trigger: "manual",
      inputPayloadRaw: "{invalid",
      parameterFieldState: Object.freeze({
        maxRuntimeSeconds: Object.freeze({ rawValue: "20" }),
        maxOutputAssets: Object.freeze({ rawValue: "100" }),
      }),
    }, DEFAULT_APPROVED_RUN_PARAMETER_DEFINITIONS);

    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.issues.map((entry) => entry.path)).toEqual([
        "systemId",
        "versionId",
        "inputPayload",
        "approvedParameters.maxRuntimeSeconds",
        "approvedParameters.maxOutputAssets",
      ]);
    }

    const valid = validateOperationalApprovedRunLaunchDraft({
      systemId: "system:alpha",
      versionId: "system:alpha:v2",
      trigger: "api",
      inputPayloadRaw: "{\"prompt\":\"hello\"}",
      parameterFieldState: Object.freeze({
        maxRuntimeSeconds: Object.freeze({ rawValue: "300" }),
        maxOutputAssets: Object.freeze({ rawValue: "10" }),
      }),
    }, DEFAULT_APPROVED_RUN_PARAMETER_DEFINITIONS);

    expect(valid.ok).toBeTrue();
    if (valid.ok) {
      expect(valid.value.approvedParameters).toEqual({
        maxRuntimeSeconds: 300,
        maxOutputAssets: 10,
      });
      expect(valid.value.trigger).toBe("api");
    }
  });

  it("maps authoritative runtime launch responses into acceptance, validation, and denial states", () => {
    const accepted = mapRuntimeStartResponseToSubmissionState({
      ok: true,
      data: {
        executionId: "execution-1",
        status: "pending",
        acceptedState: "accepted",
        systemId: "system:alpha",
        versionId: "system:alpha:v1",
        executedVersionMap: Object.freeze({
          rootVersionId: "system:alpha:v1",
          nodeVersionIds: Object.freeze({}),
        }),
        nestedExecutionLineage: Object.freeze([]),
      },
    });
    expect(accepted.kind).toBe("accepted");

    const validationError = mapRuntimeStartResponseToSubmissionState({
      ok: false,
      error: {
        code: "invalid-request",
        message: "Validation failed.",
        validationErrors: Object.freeze([
          Object.freeze({
            path: "context.metadata.approvedParameters.maxRuntimeSeconds",
            code: "out-of-range",
            message: "Max runtime exceeds policy.",
          }),
        ]),
      },
    });
    expect(validationError.kind).toBe("validation-error");
    if (validationError.kind === "validation-error") {
      expect(validationError.details[0]).toContain("context.metadata.approvedParameters.maxRuntimeSeconds");
    }

    const denied = mapRuntimeStartResponseToSubmissionState({
      ok: false,
      error: {
        code: "forbidden",
        message: "Actor cannot start this run.",
      },
    });
    expect(denied.kind).toBe("denied");
  });

  it("renders shared section structure for thin operational layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined,
        React.createElement(OperationalApprovedRunLaunchPanel, {
          responsiveProfile: createSurfaceResponsiveProfile({ viewportWidthPx: 430 }),
          surface: "thin-client",
          openSystemRunnerPath: "/build/system",
          onSubmit: async () => ({
            ok: false,
            error: {
              code: "invalid-request",
              message: "Validation failed.",
            },
          }),
        })),
    );

    expect(html).toContain("Approved run initiation");
    expect(html).toContain("Allowed parameters");
    expect(html).toContain("Input payload");
    expect(html).toContain("Launch approved run");
    expect(html).toContain("ui-responsive-form");
    expect(html).toContain("Step 1: Provide approved run identifiers and bounded parameters.");
    expect(html).toContain("Step 2: Launch the approved run and review validation feedback.");
    expect(html).toContain("ui-operational-approved-run-launch__actions");
  });
});
