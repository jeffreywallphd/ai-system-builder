import { describe, expect, it } from "bun:test";
import { InlineAssetCreationModes, InlineAssetCreationService } from "../InlineAssetCreation";

describe("InlineAssetCreationService", () => {
  it("launches inline creation through studio entry seams and preserves return target context", () => {
    const service = new InlineAssetCreationService();
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
    });

    expect(result).toBeDefined();
    const query = new URLSearchParams(result?.launchPath.split("?")[1] ?? "");
    expect(query.get("entryMode")).toBe("new");
    expect(query.get("inlineCreate")).toBe("1");
    expect(query.get("inlineMode")).toBe("system-intake");
    expect(query.get("returnTo")).toBe("/studio-shell/system");
    expect(query.get("parentAssetId")).toBe("asset:system-root");
    expect(query.get("selectedComponent")).toBe("new-component");
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
});
