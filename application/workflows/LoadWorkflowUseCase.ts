import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import { GetCanonicalLatestVersionUseCase, LoadCanonicalAssetSummaryUseCase } from "../assets-system/CanonicalAssetReadUseCases";
import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";

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
    readonly latestVersionId?: string;
    readonly fallbackReason?: string;
  };
}

export class LoadWorkflowUseCase {
  private readonly workflowRepository: IWorkflowRepository;
  private readonly workflowValidator?: IWorkflowValidator;
  private readonly canonicalIdentityService?: CanonicalAssetIdentityService;
  private readonly canonicalAssetSummaryUseCase?: LoadCanonicalAssetSummaryUseCase;
  private readonly canonicalLatestVersionUseCase?: GetCanonicalLatestVersionUseCase;

  constructor(
    workflowRepository: IWorkflowRepository,
    workflowValidator?: IWorkflowValidator,
    canonicalRepositories?: {
      readonly canonicalIdentityService: CanonicalAssetIdentityService;
      readonly assetRepository: IAssetRecordRepository;
      readonly versionRepository: IAssetVersionRepository;
      readonly queryRepository?: IAssetSystemQueryRepository;
    },
  ) {
    this.workflowRepository = workflowRepository;
    this.workflowValidator = workflowValidator;
    this.canonicalIdentityService = canonicalRepositories?.canonicalIdentityService;
    this.canonicalAssetSummaryUseCase = canonicalRepositories
      ? new LoadCanonicalAssetSummaryUseCase(canonicalRepositories.assetRepository, canonicalRepositories.versionRepository, canonicalRepositories.queryRepository)
      : undefined;
    this.canonicalLatestVersionUseCase = canonicalRepositories
      ? new GetCanonicalLatestVersionUseCase(canonicalRepositories.versionRepository, canonicalRepositories.queryRepository)
      : undefined;
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
    if (!this.canonicalIdentityService || !this.canonicalAssetSummaryUseCase || !this.canonicalLatestVersionUseCase) {
      return Object.freeze({
        preferred: false,
        fallbackReason: "Canonical repositories are not configured for workflow reads.",
      });
    }

    const assetId = await this.canonicalIdentityService.resolveAssetId("workflow-definition", workflowId);
    if (!assetId) {
      return Object.freeze({
        preferred: false,
        fallbackReason: `No canonical identity mapping was found for workflow '${workflowId}'.`,
      });
    }

    const [summary, latestVersion] = await Promise.all([
      this.canonicalAssetSummaryUseCase.execute(assetId),
      this.canonicalLatestVersionUseCase.execute(assetId),
    ]);

    return Object.freeze({
      preferred: !!summary,
      assetId,
      latestVersionId: latestVersion?.versionId,
      fallbackReason: summary ? undefined : `Canonical asset '${assetId}' could not be loaded; workflow read used legacy repository data.`,
    });
  }
}
