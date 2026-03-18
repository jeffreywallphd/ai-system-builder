import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dev sync agent", () => {
  it("exposes health and pull endpoints with token authorization", () => {
    const source = readFileSync(resolve(process.cwd(), "dev/sync-agent.js"), "utf8");

    expect(source).toContain('req.url === "/health"');
    expect(source).toContain('req.url === "/sync/pull"');
    expect(source).toContain('req.headers["x-dev-sync-token"]');
    expect(source).toContain('exec("git pull"');
    expect(source).toContain('\"git rev-parse --short HEAD\"');
  });

  it("supports parsing overwritten files and stashing them before retrying git pull", () => {
    const source = readFileSync(resolve(process.cwd(), "dev/sync-agent.js"), "utf8");

    expect(source).toContain("extractOverwrittenFiles");
    expect(source).toContain("canStashAndRetry");
    expect(source).toContain("body.stashFiles");
    expect(source).toContain('"stash"');
    expect(source).toContain('"push"');
    expect(source).toContain('"--"');
  });
});
