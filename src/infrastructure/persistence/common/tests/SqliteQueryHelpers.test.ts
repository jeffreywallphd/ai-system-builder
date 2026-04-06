import { describe, expect, it } from "bun:test";
import {
  buildSqlitePagingClause,
  createSqliteWhereBuilder,
} from "../SqliteQueryHelpers";

describe("SqliteQueryHelpers", () => {
  it("builds deterministic paging clauses", () => {
    expect(buildSqlitePagingClause(10, 0)).toEqual({
      sql: "LIMIT ? OFFSET ?",
      params: [10, 0],
    });
    expect(buildSqlitePagingClause(25)).toEqual({
      sql: "LIMIT ?",
      params: [25],
    });
    expect(buildSqlitePagingClause(undefined, 8)).toEqual({
      sql: "LIMIT -1 OFFSET ?",
      params: [8],
    });
    expect(buildSqlitePagingClause()).toEqual({
      sql: "",
      params: [],
    });
  });

  it("builds where clauses with reusable filter helpers", () => {
    const builder = createSqliteWhereBuilder();
    builder
      .addEquals("workspace_id", " workspace-alpha ")
      .addIn("status", ["active", "pending"])
      .add("created_at >= ?", "2026-04-06T12:00:00.000Z");

    expect(builder.build()).toEqual({
      sql: "WHERE workspace_id = ? AND status IN (?, ?) AND created_at >= ?",
      params: ["workspace-alpha", "active", "pending", "2026-04-06T12:00:00.000Z"],
    });
  });
});
