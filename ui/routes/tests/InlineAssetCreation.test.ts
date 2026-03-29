import { describe, expect, it } from "bun:test";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
  InlineAssetReturnStatuses,
} from "../InlineAssetCreation";
import { createStudioLaunchHandoffContract } from "../StudioHandoffContract";

describe("InlineAssetCreationService", () => {
  it("launches inline creation through studio entry seams and preserves return target context", () => {
    const service = new InlineAssetCreationService();
    const studioHandoff = createStudioLaunchHandoffContract({
      handoffId: "handoff:inline-test",
      launchSource: "workflow-studio",
      origin: {
        studioType: "workflow-studio",
        route: {
          path: "/studio-shell/workflow/wizard/inputs",
        },
      },
      target: {
        selectorSessionId: "selector:workflow:inputs",
        assetType: "dataset",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/inputs?mode=wizard#workflow-wizard-inputs",
      },
    });
    const result = service.launch({
      requestedRole: "workflow",
      mode: InlineAssetCreationModes.systemIntake,
      context: {
        source: "system-studio",
        sourceIntentKey: "create-system-component",
        sourceIntentLabel: "Create component",
        prefill: { parentAssetId: "asset:system-root" },
      },
      returnTarget: {
        routePath: "/studio-shell/system",
        contextId: "studio-shell-system",
        parentAssetId: "asset:system-root",
        parentVersionId: "asset:system-root:v1",
        selectedComponent: "new-component",
      },
      selectorLaunch: {
        selectorSessionId: "selector:workflow:inputs",
        assetType: "dataset",
        returnRoutePath: "/studio-shell/workflow/wizard?mode=wizard",
      },
      studioHandoff,
    });

    expect(result).toBeDefined();
    const query = new URLSearchParams(result?.launchPath.split("?")[1] ?? "");
    expect(query.get("entryMode")).toBe("new");
    expect(query.get("inlineCreate")).toBe("1");
    expect(query.get("inlineMode")).toBe("system-intake");
    expect(query.get("returnTo")).toBe("/studio-shell/system");
    expect(query.get("parentAssetId")).toBe("asset:system-root");
    expect(query.get("selectedComponent")).toBe("new-component");
    expect(query.get("selectorLaunch")).toBe("1");
    expect(query.get("selectorSessionId")).toBe("selector:workflow:inputs");
    expect(query.get("selectorAssetType")).toBe("dataset");
    expect(query.get("studioHandoff")).toBeDefined();
    const parsedHandoff = service.parseStudioHandoffFromSearch(`?${query.toString()}`);
    expect(parsedHandoff?.launch.handoffId).toBe("handoff:inline-test");
  });

  it("parses explicit inline return target semantics", () => {
    const service = new InlineAssetCreationService();
    const parsed = service.parseReturnTargetFromSearch("?returnTo=/studio-shell/system&returnContextId=ctx-1&parentAssetId=asset:root&selectedComponent=child-a");

    expect(parsed).toEqual({
      routePath: "/studio-shell/system",
      contextId: "ctx-1",
      parentAssetId: "asset:root",
      parentVersionId: undefined,
      selectedComponent: "child-a",
    });
  });

  it("builds and parses inline return payloads for created and cancelled flows", () => {
    const service = new InlineAssetCreationService();
    const withAsset = service.buildReturnPath({
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard?mode=wizard#workflow-wizard-inputs",
        contextId: "workflow-studio",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:dataset-created",
        versionId: "asset:dataset-created:v1",
        assetType: "dataset",
        displayName: "New dataset",
        sourceStudioType: "dataset-studio",
        sourceStudioId: "studio-datasets",
      },
    });
    const parsedWithAsset = service.parseInlineReturnFromSearch(withAsset.split("?")[1] ? `?${withAsset.split("?")[1]?.split("#")[0]}` : "");
    expect(parsedWithAsset).toEqual({
      status: "created",
      assetId: "asset:dataset-created",
      versionId: "asset:dataset-created:v1",
      assetType: "dataset",
      displayName: "New dataset",
      sourceStudioType: "dataset-studio",
      sourceStudioId: "studio-datasets",
      returnContextId: "workflow-studio",
    });

    const cancelled = service.buildReturnPath({
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard?mode=wizard",
      },
      payload: {
        status: InlineAssetReturnStatuses.cancelled,
      },
    });
    const parsedCancelled = service.parseInlineReturnFromSearch(`?${cancelled.split("?")[1]}`);
    expect(parsedCancelled?.status).toBe("cancelled");
    expect(parsedCancelled?.assetId).toBeUndefined();
  });

  it("strips one-time inline return params while preserving other query values", () => {
    const service = new InlineAssetCreationService();
    const stripped = service.stripInlineReturnFromSearch(
      "?mode=wizard&inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset&inlineVersionId=v1&assetId=asset:workflow",
    );
    expect(stripped).toBe("?mode=wizard&assetId=asset%3Aworkflow");
  });

  it("parses selector launch context from search params", () => {
    const service = new InlineAssetCreationService();
    const parsed = service.parseSelectorLaunchFromSearch(
      "?selectorLaunch=1&selectorSessionId=selector%3Aworkflow%3Asteps&selectorAssetType=agent&selectorReturnTo=%2Fstudio-shell%2Fworkflow",
    );

    expect(parsed).toEqual({
      selectorSessionId: "selector:workflow:steps",
      assetType: "agent",
      returnRoutePath: "/studio-shell/workflow",
    });
  });

  it("falls back to canonical studio handoff contract for selector launch parsing", () => {
    const service = new InlineAssetCreationService();
    const studioHandoff = createStudioLaunchHandoffContract({
      handoffId: "handoff:inline-fallback",
      launchSource: "workflow-studio",
      origin: {
        studioType: "workflow-studio",
        route: {
          path: "/studio-shell/workflow/wizard/steps",
        },
      },
      target: {
        selectorSessionId: "selector:workflow:steps",
        assetType: "agent",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/steps",
      },
    });
    const launch = service.launch({
      requestedRole: "agent",
      context: {
        source: "studio-shell",
      },
      studioHandoff,
    });

    const query = launch?.launchPath.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    params.delete("selectorLaunch");
    params.delete("selectorSessionId");
    params.delete("selectorAssetType");
    params.delete("selectorReturnTo");
    const parsed = service.parseSelectorLaunchFromSearch(`?${params.toString()}`);
    expect(parsed?.selectorSessionId).toBe("selector:workflow:steps");
    expect(parsed?.assetType).toBe("agent");
  });
});
