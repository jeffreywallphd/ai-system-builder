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
      if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry) || /\.unit\.test\.(?:ts|tsx|js|jsx)$/.test(entry)) continue;
      files.push({ path: relative(REPO_ROOT, absolutePath), source: readFileSync(absolutePath, "utf8") });
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function combinedSource(relativeDir: string): string {
  return sourceFilesUnder(relativeDir).map((file) => `\n// ${file.path}\n${file.source}`).join("\n");
}

describe("Asset Kernel read-only non-exposure boundaries", () => {
  it("allows only the narrow read-only asset definitions and resource-backed views server API surface", () => {
    const source = [
      combinedSource("modules/contracts/api"),
      combinedSource("modules/adapters/transport/api-express"),
      combinedSource("modules/hosts/server/composition"),
    ].join("\n");

    assert.match(source, /["'`]\/api\/assets\/definitions["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/definitions\/:definitionId["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/definitions\/:definitionId\/versions\/:version["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/resource-backed-views["'`]/i);
    assert.match(source, /["'`]\/api\/assets\/resource-backed-views\/:viewId["'`]/i);
    assert.doesNotMatch(source, /["'`]\/api\/assets\/(?:instances|compositions|resources|registry-summary|create|update|delete|seed|register|import|finalize|publish|execute|run|scan|sync|repair|install|start|train|validate)(?:\/|["'`?])/i);
    assert.doesNotMatch(source, /\.(?:post|put|patch|delete)\(["'`]\/api\/assets/i);
    assert.doesNotMatch(source, /\basset(?:Kernel|Registry|Library)?(?:Router|Controller)\b/i);
    assert.doesNotMatch(source, /\b(?:seedBuiltIns|registerBuiltIns|importAsset|finalizeAsset|publishAsset|executeAsset|runAsset|scanResources|syncAssets|startRuntime|probeRuntime|installRuntime|repairRuntime|trainAsset|validateAsset)\b/i);
  });

  it("allows only read-only asset definition and resource-backed view IPC/preload methods", () => {
    const publicIpcAndPreloadSource = [
      combinedSource("modules/contracts/ipc"),
      combinedSource("modules/adapters/transport/ipc-electron"),
      combinedSource("apps/desktop/src/preload"),
    ].join("\n");
    const desktopHostCompositionSource = combinedSource("modules/hosts/desktop/composition");

    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_REQUEST_CHANNEL/);
    assert.match(publicIpcAndPreloadSource, /\blistAssetDefinitions\b/);
    assert.match(publicIpcAndPreloadSource, /\breadAssetDefinition\b/);
    assert.match(publicIpcAndPreloadSource, /\blistAssetResourceBackedViews\b/);
    assert.match(publicIpcAndPreloadSource, /\breadAssetResourceBackedView\b/);
    assert.doesNotMatch(publicIpcAndPreloadSource, /ipc\.asset\.(?:instance|composition|registry-summary|create|update|delete|register|seed|import|finalize|publish|execute|run|scan|sync|repair|install|start|train|validate)/i);
    assert.doesNotMatch(publicIpcAndPreloadSource, /\b(?:createAsset|updateAsset|deleteAsset|registerAsset|seedAsset|importAsset|finalizeAsset|publishAsset|executeAsset|runAsset|scanAssets|syncAssets|repairAsset|installAsset|startAsset|trainAsset|validateAsset|listAssetInstances|readAssetInstance)\b/i);
    assert.match(desktopHostCompositionSource, /assetRegistryRead:\s*internalAssetRegistry\.readFacade/);
    assert.doesNotMatch(desktopHostCompositionSource, /assetRegistryRead:\s*internalAssetRegistry[,}]/);
    assert.doesNotMatch(desktopHostCompositionSource, /ipc\.asset\.(?:instance|composition|resource|registry-summary|create|update|delete|register|seed|import|finalize|publish|execute|run|scan|sync|repair|install|start|train|validate)/i);
  });

  it("allows read-only desktop and thin-client Asset Library pages with no mutation helpers", () => {
    const rendererSourceWithoutDesktopApi = sourceFilesUnder("apps/desktop/src/renderer")
      .filter((file) => !file.path.replace(/\\/g, "/").endsWith("src/renderer/lib/desktopApi.ts"))
      .map((file) => `\n// ${file.path}\n${file.source}`)
      .join("\n");
    const sharedAssetLibrarySource = combinedSource("modules/ui/shared/asset-library");
    const source = [
      rendererSourceWithoutDesktopApi,
      combinedSource("apps/thin-client/src"),
      sharedAssetLibrarySource,
    ].join("\n");

    assert.match(source, /\bcreateDesktopAssetLibraryClient\b/);
    assert.match(source, /\bcreateApiAssetLibraryClient\b/);
    assert.match(source, /\bAssetLibraryDefinitionCard\b/);
    assert.match(rendererSourceWithoutDesktopApi, /\bAssetLibraryPage\b/);
    assert.match(rendererSourceWithoutDesktopApi, /\bAssetLibraryFeature\b/);
    assert.match(rendererSourceWithoutDesktopApi, /key:\s*["'`]assets["'`]/);
    assert.match(combinedSource("apps/thin-client/src"), /\bAssetLibraryPage\b/);
    assert.match(combinedSource("apps/thin-client/src"), /\bAssetLibraryFeature\b/);
    assert.match(combinedSource("apps/thin-client/src/routes"), /key:\s*["'`]assets["'`]/);
    assert.match(combinedSource("apps/thin-client/src/routes"), /label:\s*["'`]Assets["'`]/);
    assert.match(source, /\blistAssetDefinitions\b/);
    assert.match(source, /\breadAssetDefinition\b/);
    assert.match(source, /\blistAssetResourceBackedViews\b/);
    assert.match(source, /\breadAssetResourceBackedView\b/);
    assert.match(sharedAssetLibrarySource, /readDetail\(definition,\s*\{\s*\}\)/);
    assert.match(sharedAssetLibrarySource, /readDetail\(selectedDefinition,\s*\{\s*includeValidation:\s*true\s*\}\)/);
    assert.doesNotMatch(source, /\b(?:createAssetDefinition|updateAssetDefinition|deleteAssetDefinition|registerAssetDefinition|seedBuiltInAssetDefinitions|importAsset|finalizeAsset|publishAsset|scanResources|executeAsset|runAsset|syncAssets|repairAsset|installAsset|startAsset|trainAsset)\b/i);
    assert.doesNotMatch(source, /\b(?:listAssetInstances|readAssetInstance|listAssetCompositions|readAssetComposition|readAssetRegistrySummary)\b/i);
  });

  it("keeps application asset services and shared host helpers free of forbidden outer-layer imports and storage scans", () => {
    const source = [
      combinedSource("modules/application/services/asset"),
      combinedSource("modules/application/use-cases/asset"),
      combinedSource("modules/hosts/shared/composition"),
    ].join("\n");

    assert.doesNotMatch(source, /from\s+["'][^"']*(?:apps\/|adapters\/transport|api-express|ipc-electron|electron|express|preload|renderer|thin-client|runtime\/.*adapter|provider-client|huggingface|openai)[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:readdir|opendir|glob|walkDir|scanResources|scanArtifacts|scanModels|scanDatasets|readBytes|readResourceBytes|fetch\(|createRuntime|startRuntime|probeRuntime|installRuntime|repairRuntime)\b/i);
    assert.doesNotMatch(source, /\b(?:PrepareTrainingDataset|DatasetPreparationUseCase|ModelTrainingPort|ModelValidationPort|ModelPublisherPort|TrainModelUseCase|ValidateModelUseCase|PublishModelUseCase|discoverModels|includeDiscovered:\s*true)\b/i);
  });

  it("keeps the external repository resource-backed provider descriptor-only", () => {
    const source = readFileSync(
      join(REPO_ROOT, "modules/application/services/asset/asset-external-repository-resource-backed-view-provider.service.ts"),
      "utf8",
    );

    assert.doesNotMatch(source, /from\s+["'][^"']*(?:adapters\/|hosts\/|api-express|ipc-electron|electron|express|preload|renderer|thin-client|huggingface)[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:HuggingFaceRepoBrowserPort|ArtifactRepoStoragePort|CredentialStore|TokenStore|listFiles|repoInfo|download\(|upload\(|commit\(|createRepo|whoami|retrieveArtifactFromRepo|storeArtifactInRepo|hasArtifactInRepo|LocalizeArtifact|PublishArtifact|RegisterArtifact|RuntimeTaskRegistryPort|readBytes|readResourceBytes|createAssetInstance|persistMapping)\b/i);
    assert.doesNotMatch(source, /node:fs|node:path|node:http|node:https|fetch\(/i);
  });

  it("keeps every resource-backed family provider descriptor-only and free of unsafe imports/operations", () => {
    const providerFiles = [
      "modules/application/services/asset/asset-artifact-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-image-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-dataset-model-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-external-repository-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-resource-backed-view-aggregate-provider.service.ts",
    ];
    const source = providerFiles
      .map((file) => `\n// ${file}\n${readFileSync(join(REPO_ROOT, file), "utf8")}`)
      .join("\n");

    assert.doesNotMatch(source, /from\s+["'][^"']*(?:modules\/adapters|modules\/hosts|adapters\/|hosts\/|api-express|ipc-electron|contracts\/api|contracts\/ipc|electron|express|preload|renderer|thin-client|runtime\/.*adapter|storage\/.*adapter|persistence\/.*adapter|provider-client|huggingface)[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:node:fs|node:path|node:http|node:https|fetch\(|readdir|opendir|glob|walkDir|scanResources|scanArtifacts|scanModels|scanDatasets|discoverModels|listFiles|repoInfo|download\(|upload\(|commit\(|createRepo|whoami|retrieveArtifactFromRepo|storeArtifactInRepo|hasArtifactInRepo|readBytes|readResourceBytes|readContent|readArtifactContent)\b/i);
    assert.doesNotMatch(source, /\b(?:RuntimeTaskRegistryPort|runtime-readiness|startRuntime|probeRuntime|installRuntime|repairRuntime|executeRuntime|DatasetPreparationUseCase|PrepareTrainingDataset|ModelTrainingPort|TrainModelUseCase|ModelValidationPort|ValidateModelUseCase|ModelPublisherPort|PublishModelUseCase|ImageGenerationUseCase|finalizeGeneratedOutput|Finaliz\w+Generated|createAssetInstance|persistMapping|registerAsset|importAsset|localizeArtifact|publishArtifact|seedBuiltIns)\b/i);
  });

  it("keeps descriptor-source seams provider-local through host wiring", () => {
    const portSource = readFileSync(
      join(REPO_ROOT, "modules/application/ports/asset/asset-resource-backed-view-provider.port.ts"),
      "utf8",
    );
    const hostProviderCompositionSource = readFileSync(
      join(REPO_ROOT, "modules/hosts/shared/composition/composeResourceBackedViewProviders.ts"),
      "utf8",
    );
    const servicesSource = [
      "modules/application/services/asset/asset-image-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-dataset-model-resource-backed-view-provider.service.ts",
      "modules/application/services/asset/asset-external-repository-resource-backed-view-provider.service.ts",
    ].map((file) => readFileSync(join(REPO_ROOT, file), "utf8")).join("\n");

    assert.doesNotMatch(portSource, /\b(?:GeneratedImageOutputDescriptorSource|SafeDatasetDescriptorSource|SafeExternalRepositoryObjectDescriptorSource|SafeArtifactRepoObjectDescriptorSource)\b/);
    assert.match(hostProviderCompositionSource, /\bcomposeResourceBackedViewProviders\b/);
    assert.doesNotMatch(hostProviderCompositionSource, /from\s+["'][^"']*(?:adapters\/storage|adapters\/runtime|adapters\/transport|provider-client|huggingface|token|api-express|ipc-electron|preload|renderer|thin-client)[^"']*["']/i);
    assert.match(servicesSource, /Provider-local descriptor-only input seam/);
    assert.match(servicesSource, /Provider-local descriptor-only input seams/);
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

  it("keeps desktop renderer Asset Library files on the read-only client boundary", () => {
    const source = combinedSource("apps/desktop/src/renderer/features/asset-library");

    assert.match(source, /\bcreateDesktopAssetLibraryClient\b/);
    assert.match(source, /\blistAssetDefinitions\b/);
    assert.match(source, /\breadAssetDefinition\b/);
    assert.doesNotMatch(source, /from\s+["'][^"']*modules\/application[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*modules\/hosts[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*adapters\/persistence[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*ipc-electron[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:createAssetDefinition|updateAssetDefinition|deleteAssetDefinition|registerAssetDefinition|seedBuiltInAssetDefinitions|importAsset|finalizeAsset|publishAsset|scanResources|executeAsset|runAsset|syncAssets|repairAsset|installAsset|startAsset|trainAsset)\b/i);
  });

  it("keeps thin-client Asset Library files on the server API read-only client boundary", () => {
    const source = combinedSource("apps/thin-client/src/features/asset-library");

    assert.match(source, /\bcreateApiAssetLibraryClient\b/);
    assert.match(source, /\blistAssetDefinitions\b/);
    assert.match(source, /\breadAssetDefinition\b/);
    assert.doesNotMatch(source, /from\s+["'][^"']*modules\/application[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*modules\/hosts[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*adapters\/persistence[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*api-express[^"']*["']/i);
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:preload|ipc-electron|electron|desktop)[^"']*["']/i);
    assert.doesNotMatch(source, /\b(?:createAssetDefinition|updateAssetDefinition|deleteAssetDefinition|registerAssetDefinition|seedBuiltInAssetDefinitions|importAsset|finalizeAsset|publishAsset|scanResources|executeAsset|runAsset|syncAssets|repairAsset|installAsset|startAsset|trainAsset)\b/i);
  });
});
