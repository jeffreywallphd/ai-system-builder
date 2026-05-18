import type { AssetReference } from "../../../contracts/asset";
import type { WorkspaceId } from "../../../contracts/workspace";
import { isWorkspaceId } from "../../../contracts/workspace";
import type { AssetRegistryDefinitionReadPort } from "../../ports/asset";
import type { UserLibraryAssetRepositoryPort, WorkspaceToWorkspaceImportRepositoryPort, WorkspaceUserLibraryDetachedCopyRepositoryPort, WorkspaceUserLibraryLinkRepositoryPort } from "../../ports/user-library";
import type { WorkspaceRepository } from "../../ports/workspace";
import type { ListWorkspaceSystemPackActivationsUseCase } from "../../use-cases/workspace";
import type {
  AssetDefinitionCard,
  AssetDefinitionDetail,
  AssetRegistryListDiagnostic,
  AssetRegistryListQuery,
  AssetRegistryListResult,
  AssetRegistryReadOptions,
  AssetRegistryResourceBackedViewCard,
  AssetRegistryResourceBackedViewDetail,
} from "./asset-registry-read-facade.types";
import { WorkspaceEffectiveAssetSourceResolver } from "./workspace-effective-asset-source-resolver.service";

export type WorkspaceAssetRegistryReadFailureCode =
  | "workspace-required"
  | "workspace-invalid"
  | "workspace-not-found"
  | "workspace-unavailable"
  | "workspace-effective-asset-view-unavailable"
  | "workspace-system-pack-activation-unavailable"
  | "workspace-asset-not-in-effective-view"
  | "workspace-resource-backed-view-deferred";

export class WorkspaceAssetRegistryReadFacadeError extends Error {
  public readonly code: WorkspaceAssetRegistryReadFailureCode;

  public constructor(code: WorkspaceAssetRegistryReadFailureCode, message = "Workspace asset registry read failed.") {
    super(message);
    this.name = "WorkspaceAssetRegistryReadFacadeError";
    this.code = code;
    this.stack = undefined;
  }
}

export interface WorkspaceAssetRegistryReadFacadeDependencies {
  readonly assetRegistryRead: AssetRegistryDefinitionReadPort;
  readonly listWorkspaceSystemPackActivations: ListWorkspaceSystemPackActivationsUseCase;
  readonly workspaceRepository?: WorkspaceRepository;
  readonly workspaceUserLibraryLinkRepository?: WorkspaceUserLibraryLinkRepositoryPort;
  readonly userLibraryAssetRepository?: UserLibraryAssetRepositoryPort;
  readonly detachedCopyRepository?: WorkspaceUserLibraryDetachedCopyRepositoryPort;
  readonly workspaceImportRepository?: WorkspaceToWorkspaceImportRepositoryPort;
}

interface ActiveSystemPackKey {
  readonly packId: string;
  readonly packVersion: string;
}

export class WorkspaceAssetRegistryReadFacade implements AssetRegistryDefinitionReadPort {
  private readonly sourceResolver: WorkspaceEffectiveAssetSourceResolver;

  public constructor(private readonly dependencies: WorkspaceAssetRegistryReadFacadeDependencies) {
    this.sourceResolver = new WorkspaceEffectiveAssetSourceResolver({
      workspaceUserLibraryLinkRepository: dependencies.workspaceUserLibraryLinkRepository,
      userLibraryAssetRepository: dependencies.userLibraryAssetRepository,
      detachedCopyRepository: dependencies.detachedCopyRepository,
      workspaceImportRepository: dependencies.workspaceImportRepository,
    });
  }

  public async listDefinitionCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetDefinitionCard>> {
    const context = await this.resolveWorkspaceContext(query.workspaceId);
    if (!context.ok) throw new WorkspaceAssetRegistryReadFacadeError(context.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, context.diagnostic.message);

    const activations = await this.readActiveSystemPacks(context.workspaceId);
    if (!activations.ok) throw new WorkspaceAssetRegistryReadFacadeError(activations.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, activations.diagnostic.message);

    const globalResult = await this.dependencies.assetRegistryRead.listDefinitionCards(query);
    const activeSystemPacks = activations.activeSystemPacks;
    const resolvedItems = await Promise.all(globalResult.items.map(async (card) => ({
      ...card,
      effectiveSourceSummary: await this.sourceResolver.resolve(context.workspaceId, card),
    } as AssetDefinitionCard)));
    const items = resolvedItems.filter((card) => isInWorkspaceEffectiveView(card, activeSystemPacks) || isUserLibraryOrWorkspaceReuseSource(card.effectiveSourceSummary?.effectiveSourceKind));
    items.sort(compareDefinitionCards);

    return {
      items,
      ...(globalResult.nextCursor ? { nextCursor: globalResult.nextCursor } : {}),
      ...(mergeDiagnostics(globalResult.diagnostics, activations.diagnostics).length
        ? { diagnostics: mergeDiagnostics(globalResult.diagnostics, activations.diagnostics) }
        : {}),
    };
  }

  public async readDefinitionDetail(ref: AssetReference, options: AssetRegistryReadOptions = {}): Promise<AssetDefinitionDetail | undefined> {
    const context = await this.resolveWorkspaceContext(options.workspaceId);
    if (!context.ok) throw new WorkspaceAssetRegistryReadFacadeError(context.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, context.diagnostic.message);

    const activations = await this.readActiveSystemPacks(context.workspaceId);
    if (!activations.ok) throw new WorkspaceAssetRegistryReadFacadeError(activations.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, activations.diagnostic.message);

    const detail = await this.dependencies.assetRegistryRead.readDefinitionDetail(ref, { ...options, includeMetadata: true });
    if (!detail) return undefined;

    if (!isDetailInWorkspaceEffectiveView(detail, activations.activeSystemPacks)) {
      throw new WorkspaceAssetRegistryReadFacadeError(
        "workspace-asset-not-in-effective-view",
        "Asset definition is not in the workspace effective asset view.",
      );
    }

    return {
      ...detail,
      effectiveSourceSummary: await this.sourceResolver.resolve(context.workspaceId, {
        definitionRef: ref,
        sourcePackId: readStringMetadata(detail.definition.metadata, "sourcePackId"),
        sourcePackVersion: readStringMetadata(detail.definition.metadata, "sourcePackVersion"),
        sourceKind: readStringMetadata(detail.definition.metadata, "sourceKind"),
        sourceLayer: readStringMetadata(detail.definition.metadata, "sourceLayer"),
        trustStatus: readStringMetadata(detail.definition.metadata, "trustStatus"),
        systemDefault: readBooleanMetadata(detail.definition.metadata, "systemDefault"),
      }),
    };
  }

  public async listResourceBackedViewCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetRegistryResourceBackedViewCard>> {
    const context = await this.resolveWorkspaceContext(query.workspaceId);
    if (!context.ok) throw new WorkspaceAssetRegistryReadFacadeError(context.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, context.diagnostic.message);
    return emptyList(diagnostic("workspace-resource-backed-view-deferred", "info", "Workspace resource-backed view descriptors are deferred until workspace resource scoping is implemented."));
  }

  public async readResourceBackedViewDetail(_viewId: string, options: AssetRegistryReadOptions = {}): Promise<AssetRegistryResourceBackedViewDetail | undefined> {
    const context = await this.resolveWorkspaceContext(options.workspaceId);
    if (!context.ok) throw new WorkspaceAssetRegistryReadFacadeError(context.diagnostic.code as WorkspaceAssetRegistryReadFailureCode, context.diagnostic.message);
    throw new WorkspaceAssetRegistryReadFacadeError(
      "workspace-resource-backed-view-deferred",
      "Workspace resource-backed view descriptors are deferred until workspace resource scoping is implemented.",
    );
  }

  private async resolveWorkspaceContext(workspaceId: unknown): Promise<
    | { readonly ok: true; readonly workspaceId: WorkspaceId }
    | { readonly ok: false; readonly diagnostic: AssetRegistryListDiagnostic }
  > {
    if (workspaceId === undefined || workspaceId === null || workspaceId === "") {
      return { ok: false, diagnostic: diagnostic("workspace-required", "error", "Workspace id is required for Asset Library reads.") };
    }
    if (!isWorkspaceId(workspaceId)) {
      return { ok: false, diagnostic: diagnostic("workspace-invalid", "error", "Workspace id is invalid for Asset Library reads.") };
    }

    if (this.dependencies.workspaceRepository) {
      const workspace = await this.dependencies.workspaceRepository.readWorkspace(workspaceId);
      if (!workspace) {
        return { ok: false, diagnostic: diagnostic("workspace-not-found", "error", "Workspace was not found for Asset Library reads.") };
      }
      if (workspace.status !== "active") {
        return { ok: false, diagnostic: diagnostic("workspace-unavailable", "error", "Workspace is unavailable for Asset Library reads.") };
      }
    }

    return { ok: true, workspaceId };
  }

  private async readActiveSystemPacks(workspaceId: WorkspaceId): Promise<
    | { readonly ok: true; readonly activeSystemPacks: readonly ActiveSystemPackKey[]; readonly diagnostics: readonly AssetRegistryListDiagnostic[] }
    | { readonly ok: false; readonly diagnostic: AssetRegistryListDiagnostic }
  > {
    const result = await this.dependencies.listWorkspaceSystemPackActivations.execute(workspaceId);
    if (result.status !== "listed") {
      return {
        ok: false,
        diagnostic: diagnostic("workspace-system-pack-activation-unavailable", "error", "Workspace system pack activations are unavailable for Asset Library reads."),
      };
    }
    return {
      ok: true,
      activeSystemPacks: result.activeSystemPacks.map((pack) => ({ packId: String(pack.packId), packVersion: String(pack.packVersion) })),
      diagnostics: result.diagnostics.map((entry) => diagnostic(entry.code, entry.severity, entry.message)),
    };
  }
}

function isUserLibraryOrWorkspaceReuseSource(kind: string | undefined): boolean {
  return kind === "user-library-linked" || kind === "user-library-copied" || kind === "workspace-imported";
}

function isInWorkspaceEffectiveView(card: AssetDefinitionCard, activeSystemPacks: readonly ActiveSystemPackKey[]): boolean {
  return activeSystemPacks.some((pack) => (
    card.sourcePackId === pack.packId &&
    card.sourcePackVersion === pack.packVersion &&
    card.sourceKind === "system" &&
    card.sourceLayer === "system-default" &&
    card.trustStatus === "system-trusted" &&
    card.systemDefault === true
  ));
}

function isDetailInWorkspaceEffectiveView(detail: AssetDefinitionDetail, activeSystemPacks: readonly ActiveSystemPackKey[]): boolean {
  const metadata = (detail.definition.metadata ?? {}) as Record<string, unknown>;
  const installMetadata = (typeof metadata.assetPackInstall === "object" && metadata.assetPackInstall !== null ? metadata.assetPackInstall : {}) as Record<string, unknown>;
  const sourcePackId = typeof metadata.sourcePackId === "string" ? metadata.sourcePackId : installMetadata.packId;
  const sourcePackVersion = typeof metadata.sourcePackVersion === "string" ? metadata.sourcePackVersion : installMetadata.packVersion;
  const sourceKind = metadata.sourceKind ?? installMetadata.sourceKind;
  const sourceLayer = metadata.sourceLayer ?? installMetadata.sourceLayer;
  const trustStatus = metadata.trustStatus ?? installMetadata.trustStatus;
  const hasTrustedInstallMarker = typeof installMetadata.entryId === "string" && typeof installMetadata.fingerprint === "string" && installMetadata.managedBy === "asset-kernel";
  return activeSystemPacks.some((pack) => (
    sourcePackId === pack.packId &&
    sourcePackVersion === pack.packVersion &&
    sourceKind === "system" &&
    sourceLayer === "system-default" &&
    trustStatus === "system-trusted" &&
    (hasTrustedInstallMarker || metadata.systemDefault === true || detail.builtIn === true)
  ));
}

function emptyList<T>(entry: AssetRegistryListDiagnostic): AssetRegistryListResult<T> {
  return { items: [], diagnostics: [entry] };
}

function diagnostic(code: string, severity: AssetRegistryListDiagnostic["severity"], message: string): AssetRegistryListDiagnostic {
  return { code, severity, message };
}

function mergeDiagnostics(
  left: readonly AssetRegistryListDiagnostic[] | undefined,
  right: readonly AssetRegistryListDiagnostic[] | undefined,
): readonly AssetRegistryListDiagnostic[] {
  return [...(left ?? []), ...(right ?? [])]
    .map((entry) => diagnostic(entry.code, entry.severity, entry.message))
    .sort((a, b) => `${a.severity}:${a.code}:${a.message}`.localeCompare(`${b.severity}:${b.code}:${b.message}`));
}

function compareDefinitionCards(left: AssetDefinitionCard, right: AssetDefinitionCard): number {
  const name = left.displayName.localeCompare(right.displayName);
  if (name !== 0) return name;
  const id = left.definitionId.localeCompare(right.definitionId);
  if (id !== 0) return id;
  return left.version.localeCompare(right.version);
}

function readStringMetadata(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function readBooleanMetadata(metadata: unknown, key: string): boolean | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}
