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

describe("Asset Kernel Phase 2C read-only non-exposure boundaries", () => {
  it("allows only the narrow read-only asset definitions server API surface", () => {
    const source = [
      combinedSource("modules/contracts/api"),
      combinedSource("modules/adapters/transport/api-express"),
      combinedSource("modules/hosts/server/composition"),
    ].join("\n");

    assert.match(source, /["'`]\/api\/assets\/definitions["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/definitions\/:definitionId["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/definitions\/:definitionId\/versions\/:version["'`]/i);
    assert.doesNotMatch(source, /["'`]\/api\/assets\/(?:instances|compositions|resources|registry-summary|seed|register|import|finalize|scan|execute)(?:\/|["'`?])/i);
    assert.doesNotMatch(source, /\.(?:post|put|patch|delete)\(["'`]\/api\/assets/i);
    assert.doesNotMatch(source, /\basset(?:Kernel|Registry|Library)?(?:Router|Controller)\b/i);
    assert.doesNotMatch(source, /\b(?:seedBuiltIns|registerBuiltIns|importAsset|finalizeAsset|scanResources|startRuntime|probeRuntime)\b/i);
  });

  it("allows only read-only asset definition IPC/preload methods", () => {
    const publicIpcAndPreloadSource = [
      combinedSource("modules/contracts/ipc"),
      combinedSource("modules/adapters/transport/ipc-electron"),
      combinedSource("apps/desktop/src/preload"),
    ].join("\n");
    const desktopHostCompositionSource = combinedSource("modules/hosts/desktop/composition");

    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /\blistAssetDefinitions\b/);
    assert.match(publicIpcAndPreloadSource, /\breadAssetDefinition\b/);
    assert.doesNotMatch(publicIpcAndPreloadSource, /ipc\.asset\.(?:instance|composition|resource|registry-summary|create|update|delete|register|seed|import|finalize|scan|execute)/i);
    assert.doesNotMatch(publicIpcAndPreloadSource, /\b(?:createAsset|updateAsset|deleteAsset|registerAsset|seedAsset|importAsset|finalizeAsset|listAssetInstances|readAssetInstance)\b/i);
    assert.match(desktopHostCompositionSource, /assetRegistryRead:\s*internalAssetRegistry\.readFacade/);
    assert.doesNotMatch(desktopHostCompositionSource, /assetRegistryRead:\s*internalAssetRegistry[,}]/);
    assert.doesNotMatch(desktopHostCompositionSource, /ipc\.asset\.(?:instance|composition|resource|registry-summary|create|update|delete|register|seed|import|finalize|scan|execute)/i);
  });

  it("does not add renderer or thin-client Asset Library UI/API clients", () => {
    const rendererSourceWithoutDesktopApi = sourceFilesUnder("apps/desktop/src/renderer")
      .filter((file) => !file.path.replace(/\\/g, "/").endsWith("src/renderer/lib/desktopApi.ts"))
      .map((file) => `\n// ${file.path}\n${file.source}`)
      .join("\n");
    const source = [
      rendererSourceWithoutDesktopApi,
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

  it("keeps public asset transports on the read port instead of local persistence or seeding seams", () => {
    const source = [
      combinedSource("modules/adapters/transport/api-express"),
      combinedSource("modules/adapters/transport/ipc-electron"),
      combinedSource("modules/adapters/transport/asset-registry"),
    ].join("\n");

    assert.match(source, /\bAssetRegistryDefinitionReadPort\b/);
    assert.doesNotMatch(source, /\bInternalAssetRegistryComposition\b/);
    assert.doesNotMatch(source, /\bcomposeInternalAssetRegistry\b/);
    assert.doesNotMatch(source, /from\s+["'][^"']*adapters\/persistence\/asset[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*built-in-asset-definition-seeding\.service[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:AssetDefinitionRepositoryPort|AssetInstanceRepositoryPort|AssetCompositionRepositoryPort|AssetBindingRepositoryPort)\b/);
    assert.doesNotMatch(source, /\b(?:RegisterAssetDefinitionUseCase|UpdateAssetDefinitionUseCase|CreateAssetInstanceUseCase|CreateAssetCompositionUseCase|BuiltInAssetDefinitionSeedingService)\b/);
  });
});
