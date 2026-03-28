import type { SystemComponentReference } from "../../../domain/system-studio/SystemAssetDomain";
import { SystemStudioIdentity } from "../../../domain/system-studio/SystemAssetDomain";
import { DefaultStudioShellApplicationService } from "../../../application/studio-shell/DefaultStudioShellApplicationService";
import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import {
  StudioShellApplicationError,
  StudioShellErrorCodes,
} from "../../../application/studio-shell/StudioShellApplicationErrors";
import {
  SystemStudioApplicationService,
} from "../../../application/system-studio/SystemStudioApplicationService";

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
