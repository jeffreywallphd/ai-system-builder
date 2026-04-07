import type { SystemComponentReference, SystemExecutionMetadata } from "@domain/system-studio/SystemAssetDomain";
import { SystemStudioIdentity } from "@domain/system-studio/SystemAssetDomain";
import { DefaultStudioShellApplicationService } from "@application/studio-shell/DefaultStudioShellApplicationService";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";
import {
  StudioShellApplicationError,
  StudioShellErrorCodes,
} from "@application/studio-shell/StudioShellApplicationErrors";
import {
  SystemStudioApplicationService,
} from "@application/system-studio/SystemStudioApplicationService";

export interface SystemStudioApiError {
  readonly code: "not-found" | "conflict" | "invalid-request" | "internal";
  readonly message: string;
}

export interface SystemStudioApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: SystemStudioApiError;
}

export interface SystemStudioChildComponentReadModel extends SystemComponentReference {
  readonly label: string;
  readonly structuralKind: "atomic" | "composite" | "system";
}

export interface ListSystemChildComponentsRequest {
  readonly studioId?: string;
  readonly draftId: string;
}

export interface MutateSystemChildComponentRequest {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
}

export interface AddSystemChildComponentRequest extends MutateSystemChildComponentRequest {
  readonly component: SystemComponentReference;
}

export interface RemoveSystemChildComponentRequest extends MutateSystemChildComponentRequest {
  readonly componentAssetId: string;
  readonly componentVersionId?: string;
}

export interface ReorderSystemChildComponentRequest extends MutateSystemChildComponentRequest {
  readonly componentAssetId: string;
  readonly componentVersionId?: string;
  readonly toIndex: number;
}

export interface UpdateSystemInterfacesRequest extends MutateSystemChildComponentRequest {
  readonly inputs: ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>;
  readonly outputs: ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>;
}

export interface UpdateSystemParametersRequest extends MutateSystemChildComponentRequest {
  readonly parameters: ReadonlyArray<{
    readonly parameterId: string;
    readonly description?: string;
    readonly valueType?: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }>;
}

export interface UpdateSystemExecutionMetadataRequest extends MutateSystemChildComponentRequest {
  readonly executionMetadata?: SystemExecutionMetadata;
}

export interface SaveSystemDefinitionRequest extends MutateSystemChildComponentRequest {}

export interface LoadSystemDefinitionRequest {
  readonly studioId?: string;
  readonly draftId?: string;
  readonly versionId?: string;
}

export interface DuplicateSystemDefinitionRequest extends MutateSystemChildComponentRequest {
  readonly sourceDraftId: string;
  readonly duplicateDraftId?: string;
  readonly duplicateAssetId?: string;
  readonly title?: string;
  readonly summary?: string;
  readonly datasetInstanceMode?: "duplicate" | "reuse";
}

export interface ModifySystemDefinitionRequest extends MutateSystemChildComponentRequest {
  readonly workflowBindings?: ReadonlyArray<{
    readonly bindingId: string;
    readonly workflowAssetId: string;
    readonly workflowVersionId?: string;
    readonly componentAlias?: string;
  }>;
  readonly datasetBindings?: ReadonlyArray<{
    readonly instanceId: string;
    readonly datasetAssetId: string;
    readonly datasetVersionId?: string;
  }>;
  readonly runtimeStatePatch?: Readonly<Record<string, unknown>>;
  readonly uiConfigurationPatch?: Readonly<Record<string, unknown>>;
}

export interface SystemCompatibilitySummaryReadModel {
  readonly status: "clean" | "warning" | "incompatible";
  readonly totalIssueCount: number;
  readonly incompatibleChildAssetCount: number;
  readonly unresolvedNestedSystemCount: number;
  readonly bindingIncompatibilityCount: number;
  readonly interfaceMismatchCount: number;
  readonly configurationMismatchCount: number;
}

export interface SystemCompatibilityInsightsReadModel {
  readonly summary: SystemCompatibilitySummaryReadModel;
  readonly incompatibleChildAssets: ReadonlyArray<{ readonly assetId: string; readonly message: string }>;
  readonly unresolvedNestedSystems: ReadonlyArray<{ readonly assetId?: string; readonly message: string }>;
  readonly bindingIncompatibilities: ReadonlyArray<{ readonly bindingId?: string; readonly message: string }>;
  readonly interfaceMismatches: ReadonlyArray<{ readonly message: string }>;
  readonly configurationMismatches: ReadonlyArray<{ readonly message: string }>;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

export class SystemStudioBackendApi {
  private readonly service: SystemStudioApplicationService;

  constructor(repository: IStudioShellRepository) {
    this.service = new SystemStudioApplicationService(new DefaultStudioShellApplicationService(repository), repository);
  }

  public async listChildComponents(request: ListSystemChildComponentsRequest): Promise<SystemStudioApiResponse<ReadonlyArray<SystemStudioChildComponentReadModel>>> {
    return this.wrap(async () => {
      const validation = await this.service.validateSystemDraft({
        studioId: request.studioId ?? SystemStudioIdentity.defaultStudioId,
        draftId: request.draftId,
      });
      const content = validation.draft.content.trim();
      const parsed = content ? JSON.parse(content) as { readonly systemSpec?: { readonly components?: ReadonlyArray<SystemComponentReference> } } : {};
      const components = parsed.systemSpec?.components ?? [];
      return Object.freeze(components.map((component, index) => Object.freeze({
        ...component,
        structuralKind: component.componentKind,
        label: component.alias?.trim() || `${component.componentKind}:${component.assetId}:${index + 1}`,
      })));
    });
  }

  public async addChildComponent(request: AddSystemChildComponentRequest) {
    return this.wrap(async () => {
      await this.service.addSystemChildComponent(request);
      return Object.freeze({ updated: true });
    });
  }

  public async removeChildComponent(request: RemoveSystemChildComponentRequest) {
    return this.wrap(async () => {
      await this.service.removeSystemChildComponent(request);
      return Object.freeze({ updated: true });
    });
  }

  public async reorderChildComponent(request: ReorderSystemChildComponentRequest) {
    return this.wrap(async () => {
      await this.service.reorderSystemChildComponent(request);
      return Object.freeze({ updated: true });
    });
  }

  public async updateInterfaces(request: UpdateSystemInterfacesRequest) {
    return this.wrap(async () => {
      await this.service.updateSystemInterfaces(request);
      return Object.freeze({ updated: true });
    });
  }

  public async updateParameters(request: UpdateSystemParametersRequest) {
    return this.wrap(async () => {
      await this.service.updateSystemParameters(request);
      return Object.freeze({ updated: true });
    });
  }

  public async updateExecutionMetadata(request: UpdateSystemExecutionMetadataRequest) {
    return this.wrap(async () => {
      await this.service.updateSystemExecutionMetadata(request);
      return Object.freeze({ updated: true });
    });
  }

  public async saveSystemDefinition(request: SaveSystemDefinitionRequest) {
    return this.wrap(async () => {
      const result = await this.service.saveSystemDefinition(request);
      return Object.freeze({
        draft: result.draft,
        serialization: result.serialization,
      });
    });
  }

  public async loadSystemDefinition(request: LoadSystemDefinitionRequest) {
    return this.wrap(async () => this.service.loadSystemDefinition(request));
  }

  public async duplicateSystemDefinition(request: DuplicateSystemDefinitionRequest) {
    return this.wrap(async () => this.service.duplicateSystemDefinition(request));
  }

  public async modifySystemDefinition(request: ModifySystemDefinitionRequest) {
    return this.wrap(async () => this.service.modifySystemDefinition(request));
  }

  public async getCompatibilityInsights(request: ListSystemChildComponentsRequest): Promise<SystemStudioApiResponse<SystemCompatibilityInsightsReadModel>> {
    return this.wrap(async () => {
      const validation = await this.service.validateSystemDraft({
        studioId: request.studioId ?? SystemStudioIdentity.defaultStudioId,
        draftId: request.draftId,
      });

      const incompatibleChildAssets = validation.issues
        .filter((issue) => issue.code === "system-child-reference-missing" || issue.code === "dependency-version-not-found")
        .map((issue) => Object.freeze({
          assetId: extractFirstAssetId(issue.message) ?? "unknown",
          message: issue.message,
        }));
      const unresolvedNestedSystems = validation.issues
        .filter((issue) => issue.code === "system-child-reference-missing" || issue.code === "system-recursion-cycle-detected" || issue.code === "system-recursion-depth-exceeded")
        .map((issue) => Object.freeze({
          assetId: extractFirstAssetId(issue.message),
          message: issue.message,
        }));
      const bindingIncompatibilities = validation.issues
        .filter((issue) => issue.code === "system-binding-type-mismatch")
        .map((issue) => Object.freeze({
          bindingId: extractFirstQuotedToken(issue.message),
          message: issue.message,
        }));
      const interfaceMismatches = validation.issues
        .filter((issue) => issue.code === "system-binding-endpoint-not-found" || issue.code === "contract-mismatch")
        .map((issue) => Object.freeze({ message: issue.message }));
      const configurationMismatches = validation.issues
        .filter((issue) => issue.code === "dependency-version-unpinned" || issue.code === "system-child-version-unpinned")
        .map((issue) => Object.freeze({ message: issue.message }));

      const errorCount = validation.issues.length;
      const summary: SystemCompatibilitySummaryReadModel = Object.freeze({
        status: errorCount === 0
          ? "clean"
          : incompatibleChildAssets.length > 0 || bindingIncompatibilities.length > 0 || unresolvedNestedSystems.length > 0
            ? "incompatible"
            : "warning",
        totalIssueCount: errorCount,
        incompatibleChildAssetCount: incompatibleChildAssets.length,
        unresolvedNestedSystemCount: unresolvedNestedSystems.length,
        bindingIncompatibilityCount: bindingIncompatibilities.length,
        interfaceMismatchCount: interfaceMismatches.length,
        configurationMismatchCount: configurationMismatches.length,
      });

      return Object.freeze({
        summary,
        incompatibleChildAssets: Object.freeze(incompatibleChildAssets),
        unresolvedNestedSystems: Object.freeze(unresolvedNestedSystems),
        bindingIncompatibilities: Object.freeze(bindingIncompatibilities),
        interfaceMismatches: Object.freeze(interfaceMismatches),
        configurationMismatches: Object.freeze(configurationMismatches),
        issues: Object.freeze(validation.issues.map((issue) => Object.freeze({
          code: issue.code,
          message: issue.message,
        }))),
      });
    });
  }

  private async wrap<T>(action: () => Promise<T>): Promise<SystemStudioApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): SystemStudioApiError {
    if (error instanceof StudioShellApplicationError) {
      const codeMap: Record<string, SystemStudioApiError["code"]> = {
        [StudioShellErrorCodes.notFound]: "not-found",
        [StudioShellErrorCodes.conflict]: "conflict",
        [StudioShellErrorCodes.invalidRequest]: "invalid-request",
      };
      return Object.freeze({ code: codeMap[error.code] ?? "invalid-request", message: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    return Object.freeze({ code: "internal", message });
  }
}

function extractFirstQuotedToken(message: string): string | undefined {
  const match = /'([^']+)'/.exec(message);
  return match?.[1];
}

function extractFirstAssetId(message: string): string | undefined {
  const match = /(asset|system):[a-zA-Z0-9:_-]+/.exec(message);
  return match?.[0];
}

