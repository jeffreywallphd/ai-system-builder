import { describe, expect, it } from "bun:test";
import { SafeSqliteRepositoryBase } from "../SafeSqliteRepositoryBase";

class TestRepositoryBase extends SafeSqliteRepositoryBase {
  public constructor() {
    super("Test repository");
  }

  public buildPaging(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    return this.buildPagingClause(limit, offset);
  }

  public runMutation(operation: string, mutation: () => { readonly changes: number }): { readonly changes: number } {
    return this.executeMutation(operation, mutation);
  }

  public resolveTimestamp(candidate?: string): string {
    return this.resolveMutationTimestamp(candidate);
  }
}

describe("SafeSqliteRepositoryBase", () => {
  it("exposes shared paging behavior", () => {
    const base = new TestRepositoryBase();
    expect(base.buildPaging(5, 2)).toEqual({
      sql: "LIMIT ? OFFSET ?",
      params: [5, 2],
    });
  });

  it("wraps mutation errors with repository context", () => {
    const base = new TestRepositoryBase();
    expect(() => base.runMutation("save record", () => {
      throw new Error("constraint violation");
    })).toThrow("Test repository persistence failed to save record");
  });

  it("resolves timestamps from provided candidates or current time", () => {
    const base = new TestRepositoryBase();
    expect(base.resolveTimestamp("2026-04-06T12:00:00.000Z")).toBe("2026-04-06T12:00:00.000Z");
    expect(base.resolveTimestamp("")).not.toBe("");
  });
});
