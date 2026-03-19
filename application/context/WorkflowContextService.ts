import { InspectContextAssemblyUseCase } from "./InspectContextAssemblyUseCase";
import type { ContextInspectionResult } from "./models/ContextInspectionResult";
import type { ContextFragmentKind } from "./models/ContextFragment";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";

export interface IResolveWorkflowContextRequest {
  readonly workflow: IWorkflow;
  readonly selectedPackageIds?: ReadonlyArray<string>;
  readonly visibilityMode?: "basic" | "advanced";
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments?: boolean;
}

export interface IResolveWorkflowContextResult {
  readonly inspection: ContextInspectionResult;
  readonly selectedPackageIds: ReadonlyArray<string>;
  readonly packageLabels: Readonly<Record<string, string>>;
}

function normalizeIds(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function normalizeKinds(values?: ReadonlyArray<string>): ReadonlyArray<ContextFragmentKind> {
  return Object.freeze(
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))] as ContextFragmentKind[]
  );
}

export class WorkflowContextService {
  public constructor(
    private readonly contextPackageRepository: IContextPackageRepository,
    private readonly inspectContextAssemblyUseCase: InspectContextAssemblyUseCase = new InspectContextAssemblyUseCase()
  ) {}

  public async inspectWorkflowContext(
    request: IResolveWorkflowContextRequest
  ): Promise<IResolveWorkflowContextResult> {
    const contextConfiguration = request.workflow.metadata.contextConfiguration;
    const configuredReferences = (contextConfiguration?.packageReferences ?? []).filter(
      (reference) => reference.isEnabled !== false
    );
    const selectedPackageIds = normalizeIds(
      request.selectedPackageIds ?? contextConfiguration?.selectedPackageIds ?? configuredReferences.map((reference) => reference.packageId)
    );

    const selectedReferences = configuredReferences.filter(
      (reference) => selectedPackageIds.length === 0 || selectedPackageIds.includes(reference.packageId)
    );
    const packages = await Promise.all(
      selectedReferences.map(async (reference, index) => {
        const contextPackage = await this.contextPackageRepository.load(reference.packageId);
        if (!contextPackage) {
          throw new Error(`Workflow context package '${reference.packageId}' was not found.`);
        }

        return {
          contextPackage,
          alias: reference.alias,
          includeFragmentIds: reference.includeFragmentIds,
          excludeFragmentIds: reference.excludeFragmentIds,
          order: index,
        };
      })
    );

    const inspection = this.inspectContextAssemblyUseCase.execute({
      assembly: {
        packages,
      },
      trimmingPolicy: {
        visibilityMode: request.visibilityMode ?? contextConfiguration?.visibilityMode,
        includeKinds: normalizeKinds(contextConfiguration?.includeKinds),
        excludeKinds: normalizeKinds(contextConfiguration?.excludeKinds),
      },
      budget: {
        maxCharacters: request.maxCharacters ?? contextConfiguration?.maxCharacters,
        maxTokens: request.maxTokens ?? contextConfiguration?.maxTokens,
        trimPartialFragments: request.trimPartialFragments ?? contextConfiguration?.trimPartialFragments,
      },
    });

    return Object.freeze({
      inspection,
      selectedPackageIds,
      packageLabels: Object.freeze(
        Object.fromEntries(
          configuredReferences.map((reference) => [reference.packageId, reference.alias ?? reference.packageId])
        )
      ),
    });
  }
}
