import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = process.cwd();

function sourceFilesUnder(relativeDir: string): readonly { path: string; source: string }[] {
  const absoluteDir = join(REPO_ROOT, relativeDir);
  const files: { path: string; source: string }[] = [];
  const stack = [absoluteDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current)) {
      const absolutePath = join(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry === "dist" || entry === "build" || entry === "coverage") continue;
        stack.push(absolutePath);
        continue;
      }
      if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry) || entry.endsWith(".unit.test.ts")) continue;
      files.push({ path: relative(REPO_ROOT, absolutePath), source: readFileSync(absolutePath, "utf8") });
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function combinedSource(relativeDir: string): string {
  return sourceFilesUnder(relativeDir).map((file) => `\n// ${file.path}\n${file.source}`).join("\n");
}

describe("Asset Kernel Phase 2B non-exposure boundaries", () => {
  it("does not register asset API routes or API contract operations", () => {
    const source = [
      combinedSource("modules/contracts/api"),
      combinedSource("modules/adapters/transport/api-express"),
      combinedSource("modules/hosts/server/composition"),
    ].join("\n");

    assert.doesNotMatch(source, /["'`]\/api\/asset(?:\/|["'`])/i);
    assert.doesNotMatch(source, /\basset(?:Kernel|Registry|Library)?(?:Route|Router|Controller|Api)\b/i);
    assert.doesNotMatch(source, /\bregisterAsset(?:Kernel|Registry|Library)?(?:Route|Routes|Api)\b/i);
  });

  it("does not register asset IPC channels or desktop preload asset methods", () => {
    const source = [
      combinedSource("modules/contracts/ipc"),
      combinedSource("modules/adapters/transport/ipc-electron"),
      combinedSource("modules/hosts/desktop/composition"),
      combinedSource("apps/desktop/src/preload"),
    ].join("\n");

    assert.doesNotMatch(source, /ipc\.asset(?:\.|-|:)/i);
    assert.doesNotMatch(source, /\bASSET_(?:KERNEL|REGISTRY|LIBRARY)?_?[A-Z_]*CHANNEL\b/);
    assert.doesNotMatch(source, /\b(?:assetKernel|assetRegistry|assetLibrary|listAssetDefinitions|readAssetDefinition|listAssetInstances|readAssetInstance)\b/);
  });

  it("does not add renderer or thin-client Asset Library UI/API clients", () => {
    const source = [
      combinedSource("apps/desktop/src/renderer"),
      combinedSource("apps/thin-client/src"),
    ].join("\n");

    assert.doesNotMatch(source, /\bAssetLibrary\b|\bAssetRegistry\b|\bAssetKernel\b/);
    assert.doesNotMatch(source, /\/api\/asset(?:\/|["'`?])/i);
    assert.doesNotMatch(source, /\b(?:assetLibraryClient|assetRegistryClient|assetKernelClient|useAssetLibrary|useAssetRegistry)\b/i);
    assert.doesNotMatch(source, /\b(?:listAssetDefinitions|readAssetDefinition|listAssetInstances|readAssetInstance)\b/);
  });

  it("keeps application asset services and shared host helpers free of forbidden outer-layer imports and storage scans", () => {
    const source = [
      combinedSource("modules/application/services/asset"),
      combinedSource("modules/application/use-cases/asset"),
      combinedSource("modules/hosts/shared/composition"),
    ].join("\n");

    assert.doesNotMatch(source, /from\s+["'][^"']*(?:apps\/|adapters\/transport|api-express|ipc-electron|electron|express|preload|renderer|thin-client|runtime\/.*adapter|provider-client|huggingface|openai)[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:readdir|opendir|glob|walkDir|scanResources|scanArtifacts|scanModels|scanDatasets|fetch\(|createRuntime|startRuntime|probeRuntime|installRuntime|repairRuntime)\b/i);
  });
});
