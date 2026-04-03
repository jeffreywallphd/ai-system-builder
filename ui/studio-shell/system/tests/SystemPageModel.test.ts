import { describe, expect, it } from "bun:test";
import {
  createSystemStudioPageModel,
  normalizeSystemStudioPageModel,
  toSerializableSystemStudioPageModel,
} from "../SystemPageModel";

describe("SystemPageModel", () => {
  it("normalizes modern and legacy page fields into a stable page model", () => {
    const normalized = normalizeSystemStudioPageModel({
      pageId: " welcome ",
      heading: "Welcome",
      layout: {
        layoutKind: "workspace",
        defaultRegionId: "workspace",
        regionIds: ["workspace", "inspector"],
      },
    }, 0);

    expect(normalized.pageId).toBe("welcome");
    expect(normalized.title).toBe("Welcome");
    expect(normalized.layout.layoutKind).toBe("workspace");
    expect(normalized.layout.regionIds).toEqual(["workspace", "inspector"]);
  });

  it("serializes page model with title and legacy heading compatibility", () => {
    const serialized = toSerializableSystemStudioPageModel(normalizeSystemStudioPageModel({
      pageId: "page-2",
      title: "Review",
      navigation: {
        route: "/review",
        supportsDeepLinking: true,
      },
    }, 1));

    expect(serialized.title).toBe("Review");
    expect(serialized.heading).toBe("Review");
  });

  it("creates new pages with template-backed layout and route defaults", () => {
    const created = createSystemStudioPageModel({
      existingPages: Object.freeze([
        normalizeSystemStudioPageModel({ pageId: "page-1", title: "Welcome" }, 0),
      ]),
      title: "Project Review",
      layoutKind: "two-pane",
    });

    expect(created.pageId).toBe("page-2");
    expect(created.layout.layoutKind).toBe("two-pane");
    expect(created.layout.regionIds).toEqual(["left-pane", "right-pane"]);
    expect(created.navigation?.route).toBe("/project-review");
  });
});
