import { describe, expect, it } from "bun:test";
import path from "node:path";
import { createBrowserRendererAliases, createSrcAliases } from "../vite/resolveViteAliases";

describe("Vite alias resolution", () => {
  it("defines canonical src aliases from a single shared source", () => {
    const repositoryRoot = process.cwd();
    const aliases = createSrcAliases(repositoryRoot);
    const aliasMap = new Map(aliases.map((entry) => [entry.find, entry.replacement]));

    expect(aliasMap.get("@src")).toBe(path.resolve(repositoryRoot, "src"));
    expect(aliasMap.get("@application")).toBe(path.resolve(repositoryRoot, "src/application"));
    expect(aliasMap.get("@domain")).toBe(path.resolve(repositoryRoot, "src/domain"));
    expect(aliasMap.get("@hosts")).toBe(path.resolve(repositoryRoot, "src/hosts"));
    expect(aliasMap.get("@infrastructure")).toBe(path.resolve(repositoryRoot, "src/infrastructure"));
    expect(aliasMap.get("@shared")).toBe(path.resolve(repositoryRoot, "src/shared"));
    expect(aliasMap.get("@ui")).toBe(path.resolve(repositoryRoot, "src/ui"));
  });

  it("applies browser renderer overrides while retaining canonical src aliases", () => {
    const repositoryRoot = process.cwd();
    const aliases = createBrowserRendererAliases(repositoryRoot);
    const csvAlias = aliases.find((entry) => entry.find === "csv-parse/sync");
    const srcAlias = aliases.find((entry) => entry.find === "@src");
    const executionAlias = aliases.find((entry) => entry.find instanceof RegExp);

    expect(csvAlias?.replacement).toBe("csv-parse/browser/esm/sync");
    expect(srcAlias?.replacement).toBe(path.resolve(repositoryRoot, "src"));
    expect(executionAlias?.replacement).toBe(
      path.resolve(repositoryRoot, "src/infrastructure/execution/createExecutionInfrastructure.browser.ts"),
    );
  });
});
