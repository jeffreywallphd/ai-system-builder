import type {
  DatasetInstanceReference,
  ImageCrossStudioHandoffContract,
  VersionedImageAssetReference,
  WorkflowReference,
} from "@domain/studio-handoff/ImageStudioHandoffContract";

export const ImageStudioReferenceResolutionIssueCodes = Object.freeze({
  missing: "missing",
  broken: "broken",
  ambiguous: "ambiguous",
  incompatible: "incompatible",
} as const);

export type ImageStudioReferenceResolutionIssueCode =
  typeof ImageStudioReferenceResolutionIssueCodes[keyof typeof ImageStudioReferenceResolutionIssueCodes];

export interface ImageStudioReferenceResolutionIssue {
  readonly code: ImageStudioReferenceResolutionIssueCode;
  readonly message: string;
  readonly path: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ResolvedImageStudioReferenceIdentity {
  readonly asset: VersionedImageAssetReference;
  readonly canonicalAssetId: string;
  readonly canonicalVersionId: string;
}

export interface ResolvedImageStudioDatasetReferenceIdentity {
  readonly referenceId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetVersionId: string;
  readonly role: DatasetInstanceReference["role"];
  readonly schemaIntentId?: string;
}

export interface ResolvedImageStudioReferenceIdentityBundle {
  readonly primaryAsset: ResolvedImageStudioReferenceIdentity;
  readonly referencedAssets: ReadonlyArray<ResolvedImageStudioReferenceIdentity>;
  readonly datasetInstances: ReadonlyArray<ResolvedImageStudioDatasetReferenceIdentity>;
  readonly workflow: {
    readonly workflowAsset: ResolvedImageStudioReferenceIdentity;
    readonly bindingId?: string;
  };
  readonly system: ResolvedImageStudioReferenceIdentity;
  readonly runtimeOwnedStores: ReadonlyArray<ResolvedImageStudioDatasetReferenceIdentity>;
}

export interface ImageStudioReferenceResolutionResult {
  readonly ok: boolean;
  readonly resolved?: ResolvedImageStudioReferenceIdentityBundle;
  readonly issues: ReadonlyArray<ImageStudioReferenceResolutionIssue>;
}

export interface ImageStudioReferenceResolutionDependencies {
  readonly resolveAsset: (
    reference: VersionedImageAssetReference,
  ) =>
    | Promise<Readonly<{ assetId: string; versionId: string; compatible?: boolean; candidates?: ReadonlyArray<string> }> | undefined>
    | Readonly<{ assetId: string; versionId: string; compatible?: boolean; candidates?: ReadonlyArray<string> }>
    | undefined;
  readonly resolveDatasetInstance: (
    reference: DatasetInstanceReference,
  ) =>
    | Promise<Readonly<{ instanceId: string; datasetAssetId: string; datasetVersionId: string; schemaIntentId?: string; compatible?: boolean; candidates?: ReadonlyArray<string> }> | undefined>
    | Readonly<{ instanceId: string; datasetAssetId: string; datasetVersionId: string; schemaIntentId?: string; compatible?: boolean; candidates?: ReadonlyArray<string> }>
    | undefined;
  readonly resolveWorkflowBinding?: (
    reference: WorkflowReference,
  ) => Promise<Readonly<{ bindingId?: string; compatible?: boolean }> | undefined> | Readonly<{ bindingId?: string; compatible?: boolean }> | undefined;
}

async function resolveAssetIdentity(
  reference: VersionedImageAssetReference,
  path: string,
  dependencies: ImageStudioReferenceResolutionDependencies,
): Promise<
  { readonly resolved?: ResolvedImageStudioReferenceIdentity; readonly issues: ReadonlyArray<ImageStudioReferenceResolutionIssue> }
> {
  const issues: ImageStudioReferenceResolutionIssue[] = [];
  const resolved = await dependencies.resolveAsset(reference);
  if (!resolved) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.missing,
      message: `Unable to resolve asset reference '${reference.assetId}@${reference.versionId}'.`,
      path,
    });
    return { issues: Object.freeze(issues) };
  }

  if (resolved.candidates && resolved.candidates.length > 1) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.ambiguous,
      message: `Asset reference '${reference.assetId}@${reference.versionId}' resolved ambiguously.`,
      path,
      details: Object.freeze({ candidates: resolved.candidates }),
    });
    return { issues: Object.freeze(issues) };
  }

  if (resolved.compatible === false) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.incompatible,
      message: `Asset reference '${reference.assetId}@${reference.versionId}' is incompatible with the target usage.`,
      path,
      details: Object.freeze({ canonicalAssetId: resolved.assetId, canonicalVersionId: resolved.versionId }),
    });
    return { issues: Object.freeze(issues) };
  }

  return {
    resolved: Object.freeze({
      asset: reference,
      canonicalAssetId: resolved.assetId,
      canonicalVersionId: resolved.versionId,
    }),
    issues: Object.freeze(issues),
  };
}

async function resolveDatasetReferenceIdentity(
  reference: DatasetInstanceReference,
  path: string,
  dependencies: ImageStudioReferenceResolutionDependencies,
): Promise<
  { readonly resolved?: ResolvedImageStudioDatasetReferenceIdentity; readonly issues: ReadonlyArray<ImageStudioReferenceResolutionIssue> }
> {
  const issues: ImageStudioReferenceResolutionIssue[] = [];

  const resolved = await dependencies.resolveDatasetInstance(reference);
  if (!resolved) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.missing,
      message: `Unable to resolve dataset instance reference '${reference.referenceId}'.`,
      path,
    });
    return { issues: Object.freeze(issues) };
  }

  if (resolved.candidates && resolved.candidates.length > 1) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.ambiguous,
      message: `Dataset instance reference '${reference.referenceId}' resolved ambiguously.`,
      path,
      details: Object.freeze({ candidates: resolved.candidates }),
    });
    return { issues: Object.freeze(issues) };
  }

  if (resolved.compatible === false) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.incompatible,
      message: `Dataset instance reference '${reference.referenceId}' is incompatible.`,
      path,
      details: Object.freeze({
        datasetAssetId: resolved.datasetAssetId,
        datasetVersionId: resolved.datasetVersionId,
        schemaIntentId: resolved.schemaIntentId,
      }),
    });
    return { issues: Object.freeze(issues) };
  }

  if (resolved.instanceId !== reference.instanceId) {
    issues.push({
      code: ImageStudioReferenceResolutionIssueCodes.broken,
      message: `Dataset instance reference '${reference.referenceId}' points to stale instance '${reference.instanceId}'.`,
      path,
      details: Object.freeze({ resolvedInstanceId: resolved.instanceId }),
    });
    return { issues: Object.freeze(issues) };
  }

  return {
    resolved: Object.freeze({
      referenceId: reference.referenceId,
      instanceId: resolved.instanceId,
      datasetAssetId: resolved.datasetAssetId,
      datasetVersionId: resolved.datasetVersionId,
      role: reference.role,
      schemaIntentId: resolved.schemaIntentId,
    }),
    issues: Object.freeze(issues),
  };
}

export class ImageStudioReferenceResolver {
  public constructor(private readonly dependencies: ImageStudioReferenceResolutionDependencies) {}

  public async resolve(contract: ImageCrossStudioHandoffContract): Promise<ImageStudioReferenceResolutionResult> {
    const issues: ImageStudioReferenceResolutionIssue[] = [];

    const primaryAsset = await resolveAssetIdentity(contract.primaryAsset, "primaryAsset", this.dependencies);
    issues.push(...primaryAsset.issues);

    const referencedAssets = await Promise.all(
      contract.referencedAssets.map((reference, index) => resolveAssetIdentity(reference, `referencedAssets[${index}]`, this.dependencies)),
    );
    referencedAssets.forEach((entry) => issues.push(...entry.issues));

    const datasetInstances = await Promise.all(
      contract.datasetInstances.map((reference, index) => resolveDatasetReferenceIdentity(reference, `datasetInstances[${index}]`, this.dependencies)),
    );
    datasetInstances.forEach((entry) => issues.push(...entry.issues));

    const workflowAsset = await resolveAssetIdentity(contract.workflow.workflow, "workflow.workflow", this.dependencies);
    issues.push(...workflowAsset.issues);

    if (this.dependencies.resolveWorkflowBinding) {
      const workflowBinding = await this.dependencies.resolveWorkflowBinding(contract.workflow);
      if (!workflowBinding) {
        issues.push({
          code: ImageStudioReferenceResolutionIssueCodes.missing,
          message: "Workflow binding reference is missing.",
          path: "workflow.bindingId",
        });
      } else if (workflowBinding.compatible === false) {
        issues.push({
          code: ImageStudioReferenceResolutionIssueCodes.incompatible,
          message: "Workflow binding reference is incompatible.",
          path: "workflow.bindingId",
          details: Object.freeze({ bindingId: workflowBinding.bindingId ?? contract.workflow.bindingId }),
        });
      }
    }

    const systemAsset = await resolveAssetIdentity(contract.systemBinding.system, "systemBinding.system", this.dependencies);
    issues.push(...systemAsset.issues);

    const systemDatasets = await Promise.all(
      contract.systemBinding.datasets.map((reference, index) => resolveDatasetReferenceIdentity(reference, `systemBinding.datasets[${index}]`, this.dependencies)),
    );
    systemDatasets.forEach((entry) => issues.push(...entry.issues));

    if (issues.length > 0 || !primaryAsset.resolved || !workflowAsset.resolved || !systemAsset.resolved) {
      return Object.freeze({ ok: false, issues: Object.freeze(issues) });
    }

    return Object.freeze({
      ok: true,
      issues: Object.freeze([]),
      resolved: Object.freeze({
        primaryAsset: primaryAsset.resolved,
        referencedAssets: Object.freeze(referencedAssets.flatMap((entry) => (entry.resolved ? [entry.resolved] : []))),
        datasetInstances: Object.freeze(datasetInstances.flatMap((entry) => (entry.resolved ? [entry.resolved] : []))),
        workflow: Object.freeze({
          workflowAsset: workflowAsset.resolved,
          bindingId: contract.workflow.bindingId,
        }),
        system: systemAsset.resolved,
        runtimeOwnedStores: Object.freeze(systemDatasets
          .flatMap((entry) => (entry.resolved ? [entry.resolved] : []))
          .filter((entry) => entry.role === "runtime-store" || entry.role === "output" || entry.role === "history" || entry.role === "comparison")),
      }),
    });
  }
}

