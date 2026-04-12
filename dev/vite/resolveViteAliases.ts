import path from "node:path";

const SOURCE_ALIAS_RELATIVE_PATHS = Object.freeze([
  { find: "@src", relativePath: "src" },
  { find: "@application", relativePath: "src/application" },
  { find: "@domain", relativePath: "src/domain" },
  { find: "@hosts", relativePath: "src/hosts" },
  { find: "@infrastructure", relativePath: "src/infrastructure" },
  { find: "@shared", relativePath: "src/shared" },
  { find: "@ui", relativePath: "src/ui" },
] as const);

export function createSrcAliases(repositoryRoot: string) {
  return SOURCE_ALIAS_RELATIVE_PATHS.map(({ find, relativePath }) => ({
    find,
    replacement: path.resolve(repositoryRoot, relativePath),
  }));
}

export function createBrowserRendererAliases(repositoryRoot: string) {
  return [
    {
      find: /^@infrastructure\/execution\/createExecutionInfrastructure$/,
      replacement: path.resolve(
        repositoryRoot,
        "src/infrastructure/execution/createExecutionInfrastructure.browser.ts",
      ),
    },
    ...createSrcAliases(repositoryRoot),
    {
      find: "./modelManagementDependencies",
      replacement: path.resolve(
        repositoryRoot,
        "src/ui/composition/modelManagementDependencies.browser.ts",
      ),
    },
    {
      find: "../../infrastructure/execution/createExecutionInfrastructure",
      replacement: path.resolve(
        repositoryRoot,
        "src/infrastructure/execution/createExecutionInfrastructure.browser.ts",
      ),
    },
    {
      find: "csv-parse/sync",
      replacement: "csv-parse/browser/esm/sync",
    },
  ];
}
