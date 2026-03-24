import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import { GetCanonicalLatestVersionUseCase, GetCanonicalProvenanceSummaryUseCase, LoadCanonicalAssetSummaryUseCase } from "../assets-system/CanonicalAssetReadUseCases";
import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";
import { GetAssetDependencyHealthUseCase } from "../assets-system/GetAssetDependencyHealthUseCase";
import { GetAssetImpactAnalysisUseCase } from "../assets-system/GetAssetImpactAnalysisUseCase";
import { GetCanonicalDependencyStateUseCase } from "../assets-system/CanonicalDependencyStateUseCase";
import { CanonicalEntityReadResolver } from "../assets-system/CanonicalEntityReadResolver";
import { CanonicalEntityOperationalReadService } from "../assets-system/CanonicalEntityOperationalReadService";
import type { ICanonicalAssetIdentityRepository } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";

export interface ILoadWorkflowRequest {
  readonly workflowId: string;

  /**
   * Whether to validate the workflow after loading.
   */
  readonly validateOnLoad?: boolean;

  /**
   * When true, invalid workflows may still be returned and validation will be included.
   */
  readonly allowInvalidLoad?: boolean;

  /**
   * Whether a missing workflow should throw.
   */
  readonly throwIfNotFound?: boolean;

  /**
   * Optional validation options for post-load validation.
   */
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface ILoadWorkflowResult {
  readonly workflow?: IWorkflow;
  readonly validation?: IWorkflowValidationResult;
  readonly canonicalRead?: {
    readonly preferred: boolean;
    readonly assetId?: string;
    readonly pinnedVersionId?: string;
    readonly latestVersionId?: string;
    readonly provenance?: {
      readonly directUpstreamCount: number;
      readonly directDownstreamCount: number;
      readonly producingTransformationCount: number;
      readonly lineageConfidence: "exact" | "partial";
    };
    readonly dependencyState?: {
      readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
      readonly reasons: ReadonlyArray<string>;
      readonly nextActions: ReadonlyArray<string>;
    };
    readonly fallbackReason?: string;
  };
}

export class LoadWorkflowUseCase {
  private readonly workflowRepository: IWorkflowRepository;
  private readonly workflowValidator?: IWorkflowValidator;
  private readonly canonicalReadService: CanonicalEntityOperationalReadService;

  constructor(
    workflowRepository: IWorkflowRepository,
    workflowValidator?: IWorkflowValidator,
    canonicalRepositories?: {
      readonly canonicalIdentityService: CanonicalAssetIdentityService;
      readonly assetRepository: IAssetRecordRepository;
      readonly versionRepository: IAssetVersionRepository;
      readonly queryRepository?: IAssetSystemQueryRepository;
      readonly identityRepository: ICanonicalAssetIdentityRepository;
      readonly lineageRepository: IAssetLineageRepository;
      readonly transformationRepository: IAssetTransformationRepository;
    },
  ) {
    this.workflowRepository = workflowRepository;
    this.workflowValidator = workflowValidator;
    this.canonicalReadService = new CanonicalEntityOperationalReadService(canonicalRepositories
      ? new CanonicalEntityReadResolver(
        canonicalRepositories.canonicalIdentityService,
        new LoadCanonicalAssetSummaryUseCase(canonicalRepositories.assetRepository, canonicalRepositories.versionRepository, canonicalRepositories.queryRepository),
        new GetCanonicalLatestVersionUseCase(canonicalRepositories.versionRepository, canonicalRepositories.queryRepository),
        new GetCanonicalProvenanceSummaryUseCase(canonicalRepositories.lineageRepository, canonicalRepositories.transformationRepository, canonicalRepositories.queryRepository),
        new GetCanonicalDependencyStateUseCase(
          canonicalRepositories.versionRepository,
          canonicalRepositories.identityRepository,
          new GetAssetDependencyHealthUseCase(canonicalRepositories.lineageRepository, canonicalRepositories.transformationRepository, canonicalRepositories.versionRepository),
          new GetAssetImpactAnalysisUseCase(canonicalRepositories.lineageRepository, canonicalRepositories.transformationRepository, canonicalRepositories.versionRepository),
          new GetCanonicalProvenanceSummaryUseCase(canonicalRepositories.lineageRepository, canonicalRepositories.transformationRepository, canonicalRepositories.queryRepository),
        ),
      )
      : undefined);
  }

  public async execute(
    request: ILoadWorkflowRequest
  ): Promise<ILoadWorkflowResult> {
    const workflowId = request.workflowId.trim();

    if (!workflowId) {
      throw new Error("LoadWorkflowUseCase requires a non-empty workflowId.");
    }

    const workflow = await this.workflowRepository.load(workflowId);

    if (!workflow) {
      if (request.throwIfNotFound ?? true) {
        throw new Error(`Workflow '${workflowId}' was not found.`);
      }

      return Object.freeze({
        workflow: undefined,
        validation: undefined,
        canonicalRead: Object.freeze({
          preferred: false,
          fallbackReason: "Workflow was not found in the legacy repository; canonical lookup was not applied.",
        }),
      });
    }

    let validation: IWorkflowValidationResult | undefined;

    if (request.validateOnLoad ?? true) {
      validation = this.workflowValidator
        ? this.workflowValidator.validateWorkflow(
            workflow,
            request.validationOptions
          )
        : workflow.validate();

      if (!(request.allowInvalidLoad ?? true) && !validation.isValid) {
        throw new Error(
          `Loaded workflow '${workflow.id}' failed validation: ${validation.messages.join(
            " | "
          )}`
        );
      }
    }

    const canonicalRead = await this.loadCanonicalReadSummary(workflow.id);

    return Object.freeze({
      workflow,
      validation,
      canonicalRead,
    });
  }

  private async loadCanonicalReadSummary(workflowId: string): Promise<ILoadWorkflowResult["canonicalRead"]> {
    return this.canonicalReadService.resolveSummary({
      entityType: "workflow-definition",
      entityId: workflowId,
      fallbackWhenUnavailable: "Canonical repositories are not configured for workflow reads.",
    });
  }
}
