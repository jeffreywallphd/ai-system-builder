import { describe, expect, it } from "bun:test";
import { InlineAssetCreationService, InlineAssetReturnStatuses } from "../InlineAssetCreation";
import { createStudioLaunchHandoffContract, serializeStudioLaunchHandoffContract } from "../StudioHandoffContract";
import { StudioReturnPayloadResolutionKinds, StudioReturnPayloadResolver } from "../StudioReturnPayloadResolution";

describe("StudioReturnPayloadResolver", () => {
  it("resolves valid created payloads with handoff selector context", () => {
    const inlineService = new InlineAssetCreationService();
    const resolver = new StudioReturnPayloadResolver(inlineService);
    const handoff = createStudioLaunchHandoffContract({
      handoffId: "handoff:return:created",
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
        selectorTargetId: "workflow-inputs:dataset",
        originatingField: "inputs.dataset",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/inputs",
        contextId: "selector:workflow:inputs",
      },
    });
    const returnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: `/studio-shell/workflow/wizard/inputs?studioHandoff=${serializeStudioLaunchHandoffContract(handoff)}`,
        contextId: "selector:workflow:inputs",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:dataset:new",
        versionId: "asset:dataset:new:v1",
        assetType: "dataset",
      },
    });

    const query = returnPath.split("?")[1] ?? "";
    const resolution = resolver.resolveFromSearch(`?${query}`);
    expect(resolution.handled).toBeTrue();
    expect(resolution.kind).toBe(StudioReturnPayloadResolutionKinds.created);
    expect(resolution.selectorSessionId).toBe("selector:workflow:inputs");
    expect(resolution.selectorTargetId).toBe("workflow-inputs:dataset");
    expect(resolution.returnedAsset?.assetId).toBe("asset:dataset:new");
  });

  it("marks malformed created payloads as invalid", () => {
    const resolver = new StudioReturnPayloadResolver();
    const resolution = resolver.resolveFromSearch(
      "?inlineReturn=1&inlineStatus=created&inlineAssetId=dataset-non-canonical&inlineAssetType=dataset",
    );

    expect(resolution.handled).toBeTrue();
    expect(resolution.kind).toBe(StudioReturnPayloadResolutionKinds.invalid);
    expect(resolution.issues.length).toBeGreaterThan(0);
  });

  it("resolves no-selection payloads explicitly", () => {
    const resolver = new StudioReturnPayloadResolver();
    const resolution = resolver.resolveFromSearch(
      "?inlineReturn=1&inlineStatus=no-selection&returnContextId=selector%3Aworkflow%3Asteps",
    );
    expect(resolution.handled).toBeTrue();
    expect(resolution.kind).toBe(StudioReturnPayloadResolutionKinds.noSelection);
    expect(resolution.selectorSessionId).toBe("selector:workflow:steps");
  });

  it("resolves abandoned payloads explicitly", () => {
    const resolver = new StudioReturnPayloadResolver();
    const resolution = resolver.resolveFromSearch(
      "?inlineReturn=1&inlineStatus=abandoned&returnContextId=selector%3Aworkflow%3Asteps&inlineHandoffId=handoff%3Aworkflow%3Asteps%3A1",
    );

    expect(resolution.handled).toBeTrue();
    expect(resolution.kind).toBe(StudioReturnPayloadResolutionKinds.abandoned);
    expect(resolution.handoffId).toBe("handoff:workflow:steps:1");
  });

  it("rejects payloads whose inline handoff id disagrees with canonical studio handoff", () => {
    const inlineService = new InlineAssetCreationService();
    const resolver = new StudioReturnPayloadResolver(inlineService);
    const handoff = createStudioLaunchHandoffContract({
      handoffId: "handoff:return:canonical",
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
        contextId: "selector:workflow:steps",
      },
    });
    const returnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: `/studio-shell/workflow/wizard/steps?studioHandoff=${serializeStudioLaunchHandoffContract(handoff)}`,
        contextId: "selector:workflow:steps",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:agent:new",
        assetType: "agent",
        handoffId: "handoff:return:other",
      },
    });

    const query = returnPath.split("?")[1] ?? "";
    const resolution = resolver.resolveFromSearch(`?${query}`);
    expect(resolution.handled).toBeTrue();
    expect(resolution.kind).toBe(StudioReturnPayloadResolutionKinds.invalid);
    expect(resolution.issues[0]?.path).toBe("inlineHandoffId");
  });
});
