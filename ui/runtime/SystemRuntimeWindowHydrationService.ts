import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
  type ComfyImageManipulationConfig,
} from "../../application/system-studio/ComfyImageManipulationPropertySchema";
import { ImageManipulationSystemTemplate } from "../../application/system-studio/ImageManipulationSystemTemplate";
import type { SystemRuntimeWindowLaunchContract } from "../../application/system-runtime/SystemRuntimeWindowLaunchContract";
import { parseSystemSerializationDocument } from "../../domain/system-studio/SystemSerializationContract";
import type { StudioShellSnapshotReadModel } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { parseSystemStudioDraftDocument } from "../studio-shell/system/SystemStudioDraftDocument";
import type { ImageManipulationSelectionRole } from "../components/studio-shell/image-manipulation/ImageManipulationSelectionState";

export type RuntimeHydrationIssueSeverity = "warning" | "error";

export interface RuntimeHydrationIssue {
  readonly code: string;
  readonly severity: RuntimeHydrationIssueSeverity;
  readonly message: string;
  readonly path?: string;
}

export interface HydratedRuntimeDatasetBinding {
  readonly bindingId: string;
  readonly datasetBindingId?: string;
  readonly role: "input" | "output" | "reference" | "unknown";
  readonly optional: boolean;
  readonly datasetAssetId?: string;
  readonly datasetAssetVersionId?: string;
  readonly datasetInstanceId?: string;
  readonly storageInstanceId?: string;
  readonly storageInstanceRef?: string;
  readonly storageBindingArea?: string;
  readonly sharingScope: "system-owned" | "subsystem-owned" | "shared";
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface HydratedRuntimeSelectionState {
  readonly selectedDatasetBindingId?: string;
  readonly activePreviewRole: ImageManipulationSelectionRole;
  readonly selectedRecordIds: Readonly<Record<string, string>>;
  readonly gallerySelectionRecordIds: ReadonlyArray<string>;
}

export interface SystemRuntimeHydratedState {
  readonly launch: SystemRuntimeWindowLaunchContract;
  readonly resolvedSystemAsset: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly targetKind: SystemRuntimeWindowLaunchContract["launchTarget"]["targetKind"];
    readonly subsystemId?: string;
  };
  readonly resolvedWorkflowTemplate: {
    readonly workflowTemplateAssetId: string;
    readonly workflowTemplateVersionId?: string;
    readonly bindingId?: string;
  };
  readonly resolvedPage: {
    readonly pageBindingId: string;
    readonly pageId?: string;
    readonly pageTitle?: string;
  };
  readonly propertySchema: {
    readonly schemaId: string;
    readonly presetId: string;
    readonly defaults: ComfyImageManipulationConfig;
  };
  readonly executionMetadata?: Readonly<Record<string, unknown>>;
  readonly datasetBindings: ReadonlyArray<HydratedRuntimeDatasetBinding>;
  readonly storageInstances: ReadonlyArray<{
    readonly storageInstanceId?: string;
    readonly storageInstanceRef?: string;
    readonly sharingScope: HydratedRuntimeDatasetBinding["sharingScope"];
  }>;
  readonly initialSelection: HydratedRuntimeSelectionState;
  readonly runtimeState?: Readonly<Record<string, unknown>>;
  readonly debug: Readonly<Record<string, unknown>>;
}

export interface SystemRuntimeWindowHydrationResult {
  readonly ok: boolean;
  readonly state?: SystemRuntimeHydratedState;
  readonly issues: ReadonlyArray<RuntimeHydrationIssue>;
}

function createIssue(
  code: string,
  severity: RuntimeHydrationIssueSeverity,
  message: string,
  path?: string,
): RuntimeHydrationIssue {
  return Object.freeze({
    code,
    severity,
    message,
    path,
  });
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function normalizeSelectedRecordIds(value: unknown): Readonly<Record<string, string>> {
  const record = readRecord(value);
  if (!record) {
    return Object.freeze({});
  }
  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    const normalizedKey = key.trim();
    const normalizedValue = typeof raw === "string" ? raw.trim() : "";
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    next[normalizedKey] = normalizedValue;
  }
  return Object.freeze(next);
}

function normalizePreviewRole(value: unknown): ImageManipulationSelectionRole | undefined {
  return value === "source" || value === "output" || value === "reference"
    ? value
    : undefined;
}

function normalizeGallerySelectionRecordIds(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  return Object.freeze(value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0));
}

function toBindingRole(bindingId: string): HydratedRuntimeDatasetBinding["role"] {
  if (bindingId === ImageManipulationSystemTemplate.compositionBindings.inputDatasetBindingId) {
    return "input";
  }
  if (bindingId === ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId) {
    return "output";
  }
  if (bindingId === ImageManipulationSystemTemplate.compositionBindings.optionalReferenceDatasetBindingId) {
    return "reference";
  }
  return "unknown";
}

function resolveSelectionState(input: {
  readonly launch: SystemRuntimeWindowLaunchContract;
  readonly runtimeState?: Readonly<Record<string, unknown>>;
  readonly datasetBindings: ReadonlyArray<HydratedRuntimeDatasetBinding>;
}): HydratedRuntimeSelectionState {
  const launchSelection = input.launch.initialSelection;
  const persistedSelection = readRecord(input.runtimeState?.selection);
  const selectedRecordIds = normalizeSelectedRecordIds(
    persistedSelection?.selectedRecordIds ?? launchSelection.selectedRecordIds,
  );
  const activePreviewRole = normalizePreviewRole(
    persistedSelection?.activePreviewRole ?? launchSelection.activePreviewRole,
  ) ?? "output";
  const selectedDatasetBindingIdRaw = typeof persistedSelection?.selectedDatasetBindingId === "string"
    ? persistedSelection.selectedDatasetBindingId.trim()
    : launchSelection.selectedDatasetBindingId?.trim();
  const selectedDatasetBindingId = selectedDatasetBindingIdRaw
    || input.datasetBindings[0]?.bindingId;
  const gallerySelectionRecordIds = normalizeGallerySelectionRecordIds(persistedSelection?.gallerySelectionRecordIds);
  if (gallerySelectionRecordIds.length > 0) {
    return Object.freeze({
      selectedDatasetBindingId,
      activePreviewRole,
      selectedRecordIds,
      gallerySelectionRecordIds,
    });
  }
  const fallbackGallerySelection = selectedDatasetBindingId
    ? selectedRecordIds[selectedDatasetBindingId]
    : undefined;
  return Object.freeze({
    selectedDatasetBindingId,
    activePreviewRole,
    selectedRecordIds,
    gallerySelectionRecordIds: fallbackGallerySelection
      ? Object.freeze([fallbackGallerySelection])
      : Object.freeze([]),
  });
}

function mapTemplateDefaultDatasetBindings(): ReadonlyArray<HydratedRuntimeDatasetBinding> {
  return Object.freeze(ImageManipulationSystemTemplate.datasetInstances.map((entry) => Object.freeze({
    bindingId: entry.bindingId,
    datasetBindingId: entry.bindingId,
    role: toBindingRole(entry.bindingId),
    optional: entry.optional === true,
    datasetAssetId: entry.datasetAssetId,
    datasetAssetVersionId: entry.datasetAssetVersionId,
    datasetInstanceId: entry.instanceId,
    storageBindingArea: entry.storageBindingArea,
    sharingScope: "shared",
    metadata: Object.freeze({
      role: entry.bindingId === ImageManipulationSystemTemplate.compositionBindings.inputDatasetBindingId
        ? "input"
        : entry.bindingId === ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId
          ? "output"
          : "reference",
      templateDefault: true,
      optional: entry.optional === true,
    }),
  })));
}

function mergeDatasetBindings(launch: SystemRuntimeWindowLaunchContract): ReadonlyArray<HydratedRuntimeDatasetBinding> {
  const byBindingId = new Map<string, HydratedRuntimeDatasetBinding>();
  for (const entry of mapTemplateDefaultDatasetBindings()) {
    byBindingId.set(entry.bindingId, entry);
  }
  for (const binding of launch.datasetBindings) {
    const current = byBindingId.get(binding.bindingId);
    const roleFromMetadata = typeof binding.metadata.role === "string" ? binding.metadata.role : undefined;
    byBindingId.set(binding.bindingId, Object.freeze({
      bindingId: binding.bindingId,
      datasetBindingId: binding.datasetBindingId ?? current?.datasetBindingId,
      role: roleFromMetadata === "input" || roleFromMetadata === "output" || roleFromMetadata === "reference"
        ? roleFromMetadata
        : (current?.role ?? toBindingRole(binding.bindingId)),
      optional: binding.metadata.optional === true || current?.optional === true,
      datasetAssetId: binding.datasetAssetId ?? current?.datasetAssetId,
      datasetAssetVersionId: binding.datasetAssetVersionId ?? current?.datasetAssetVersionId,
      datasetInstanceId: binding.datasetInstanceId ?? current?.datasetInstanceId,
      storageInstanceId: binding.storageInstanceId ?? current?.storageInstanceId,
      storageInstanceRef: binding.storageInstanceRef ?? current?.storageInstanceRef,
      storageBindingArea: binding.storageBindingArea ?? current?.storageBindingArea,
      sharingScope: binding.sharingScope,
      metadata: Object.freeze({
        ...(current?.metadata ?? {}),
        ...binding.metadata,
      }),
    }));
  }
  return Object.freeze([...byBindingId.values()]);
}

export interface SystemRuntimeWindowHydrationInput {
  readonly launchContract?: SystemRuntimeWindowLaunchContract;
  readonly snapshot?: StudioShellSnapshotReadModel;
}

export class SystemRuntimeWindowHydrationService {
  public hydrate(input: SystemRuntimeWindowHydrationInput): SystemRuntimeWindowHydrationResult {
    const issues: RuntimeHydrationIssue[] = [];
    const launch = input.launchContract;
    if (!launch) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([createIssue(
          "runtime-window.launch-contract.missing",
          "error",
          "Runtime launch contract is missing or invalid.",
          "launchContract",
        )]),
      });
    }

    const draft = input.snapshot?.draft;
    if (!draft) {
      issues.push(createIssue(
        "runtime-window.snapshot.draft-missing",
        "warning",
        "Studio draft snapshot is unavailable; hydrating from launch contract and template defaults.",
        "snapshot.draft",
      ));
    }
    if (draft && draft.assetId !== launch.launchTarget.systemAssetId) {
      issues.push(createIssue(
        "runtime-window.snapshot.asset-mismatch",
        "warning",
        "Draft asset id does not match the launch contract system asset id.",
        "snapshot.draft.assetId",
      ));
    }

    let executionMetadata: Readonly<Record<string, unknown>> | undefined;
    let runtimeState: Readonly<Record<string, unknown>> | undefined;
    let resolvedWorkflowBinding: { readonly bindingId?: string; readonly workflowAssetId: string; readonly workflowVersionId?: string } | undefined;
    let resolvedPageId: string | undefined;
    let resolvedPageTitle: string | undefined;

    if (draft?.content) {
      try {
        const serialization = parseSystemSerializationDocument({
          content: draft.content,
          dependencies: draft.dependencies,
        });
        executionMetadata = readRecord(serialization.systemSpec.executionMetadata);
        runtimeState = readRecord(serialization.contract?.runtime.state);
        const workflowBinding = serialization.contract?.runtime.workflowBindings[0];
        if (workflowBinding) {
          resolvedWorkflowBinding = Object.freeze({
            bindingId: workflowBinding.bindingId,
            workflowAssetId: workflowBinding.workflowAssetId,
            workflowVersionId: workflowBinding.workflowVersionId,
          });
        }
      } catch (error) {
        issues.push(createIssue(
          "runtime-window.serialization.parse-failed",
          "warning",
          error instanceof Error ? error.message : "System serialization could not be parsed.",
          "snapshot.draft.content",
        ));
      }

      const document = parseSystemStudioDraftDocument(draft.content);
      const pageLayout = document.canvasAuthoring.pageLayouts.find((layout) => {
        return layout.panels.some((panel) => (
          panel.content?.kind === "embedded-studio"
          && panel.content.studioAssetId === launch.launchTarget.pageBindingId
        ));
      });
      const page = document.systemSpec.pages.find((entry) => entry.pageId === pageLayout?.pageId)
        ?? document.systemSpec.pages[0];
      resolvedPageId = page?.pageId;
      resolvedPageTitle = page?.title;
      if (!pageLayout) {
        issues.push(createIssue(
          "runtime-window.page-binding.unresolved",
          "warning",
          `No page layout was resolved for page binding '${launch.launchTarget.pageBindingId}'.`,
          "launchTarget.pageBindingId",
        ));
      }
    }

    const resolvedWorkflowTemplateAssetId = launch.resolution.template?.workflowTemplateAssetId
      ?? resolvedWorkflowBinding?.workflowAssetId
      ?? ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId;
    const resolvedWorkflowTemplateVersionId = launch.resolution.template?.workflowTemplateVersionId
      ?? resolvedWorkflowBinding?.workflowVersionId
      ?? ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId;
    if (!resolvedWorkflowTemplateAssetId) {
      issues.push(createIssue(
        "runtime-window.workflow-template.missing",
        "error",
        "Workflow template could not be resolved for runtime hydration.",
        "resolution.template.workflowTemplateAssetId",
      ));
    }

    const datasetBindings = mergeDatasetBindings(launch);
    if (datasetBindings.length < 1) {
      issues.push(createIssue(
        "runtime-window.dataset-bindings.missing",
        "error",
        "No dataset bindings were resolved for runtime hydration.",
        "datasetBindings",
      ));
    }

    const presetId = launch.initialSelection.presetId ?? ComfyImageManipulationPropertySchema.defaultPresetId;
    const defaultConfig = createComfyImageManipulationDefaultConfig({ presetId });
    const runtimeStateFromLaunch = readRecord(launch.runtimeContextPayload.runtimeState);
    const mergedRuntimeState = runtimeStateFromLaunch ?? runtimeState;
    const initialSelection = resolveSelectionState({
      launch,
      runtimeState: mergedRuntimeState,
      datasetBindings,
    });

    const state: SystemRuntimeHydratedState = Object.freeze({
      launch,
      resolvedSystemAsset: Object.freeze({
        assetId: draft?.assetId ?? launch.launchTarget.systemAssetId,
        versionId: launch.launchTarget.systemAssetVersionId,
        targetKind: launch.launchTarget.targetKind,
        subsystemId: launch.launchTarget.subsystemId,
      }),
      resolvedWorkflowTemplate: Object.freeze({
        workflowTemplateAssetId: resolvedWorkflowTemplateAssetId,
        workflowTemplateVersionId: resolvedWorkflowTemplateVersionId,
        bindingId: resolvedWorkflowBinding?.bindingId
          ?? ImageManipulationSystemTemplate.compositionBindings.workflowTemplateBindingId,
      }),
      resolvedPage: Object.freeze({
        pageBindingId: launch.launchTarget.pageBindingId,
        pageId: resolvedPageId,
        pageTitle: resolvedPageTitle,
      }),
      propertySchema: Object.freeze({
        schemaId: ImageManipulationSystemTemplate.compositionBindings.propertySchemaBindingId,
        presetId,
        defaults: defaultConfig,
      }),
      executionMetadata,
      datasetBindings,
      storageInstances: Object.freeze(datasetBindings.map((binding) => Object.freeze({
        storageInstanceId: binding.storageInstanceId,
        storageInstanceRef: binding.storageInstanceRef,
        sharingScope: binding.sharingScope,
      }))),
      initialSelection,
      runtimeState: mergedRuntimeState,
      debug: Object.freeze({
        launchId: launch.launchId,
        studioId: launch.resolution.studioId,
        draftId: draft?.draftId ?? launch.resolution.draftId,
        resolvedFromDraft: Boolean(draft),
      }),
    });

    return Object.freeze({
      ok: !issues.some((issue) => issue.severity === "error"),
      state,
      issues: Object.freeze(issues),
    });
  }
}
