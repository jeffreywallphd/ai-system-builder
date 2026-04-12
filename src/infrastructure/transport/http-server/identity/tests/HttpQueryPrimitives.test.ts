import { describe, expect, it } from "bun:test";
import {
  mergeOptionalStringLists,
  normalizeOptionalString,
  parseOptionalMultiEnumList,
  parseOptionalStringList,
  parseSharedListPaginationFromQuery,
} from "../primitives/HttpQueryPrimitives";

describe("HttpQueryPrimitives", () => {
  it("normalizes optional query string values", () => {
    expect(normalizeOptionalString("  workspace-alpha  ")).toBe("workspace-alpha");
    expect(normalizeOptionalString("   ")).toBeUndefined();
    expect(normalizeOptionalString(null)).toBeUndefined();
  });

  it("parses shared pagination values from canonical list query conventions", () => {
    const parsed = parseSharedListPaginationFromQuery(new URLSearchParams("limit=25&offset=5"));
    expect(parsed).toEqual({
      ok: true,
      limit: 25,
      offset: 5,
    });
  });

  it("returns validation issue metadata when pagination query values are invalid", () => {
    const parsed = parseSharedListPaginationFromQuery(new URLSearchParams("limit=0"));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected invalid pagination query to fail.");
    }
    expect(parsed.issue.path).toBe("limit");
  });

  it("supports repeated-value query enums with csv fallback behavior", () => {
    const parsed = parseOptionalMultiEnumList(
      new URLSearchParams("status=queued&status=running&statuses=failed"),
      "status",
      "statuses",
      Object.freeze(["queued", "running", "failed"] as const),
    );
    expect(parsed).toEqual({
      ok: true,
      value: ["queued", "running"],
    });
  });

  it("normalizes and de-duplicates repeated and csv query string list values", () => {
    const list = parseOptionalStringList(
      new URLSearchParams("ownerUserId=user-1&ownerUserId=user-1&ownerUserIds=user-2,user-3"),
      "ownerUserId",
      "ownerUserIds",
    );

    expect(list).toEqual(["user-1", "user-2", "user-3"]);
    expect(mergeOptionalStringLists(list, Object.freeze(["user-3", "user-4"]))).toEqual([
      "user-1",
      "user-2",
      "user-3",
      "user-4",
    ]);
  });
});
