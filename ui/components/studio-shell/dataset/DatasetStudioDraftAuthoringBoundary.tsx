import { ExperienceAssetModeIds, type ExperienceAssetDefinition } from "../../../studio-shell/experience-assets/ExperienceAssetContracts";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import ExperienceAssetAuthoringBoundary from "../experience-assets/ExperienceAssetAuthoringBoundary";
import DataStudioPreparationWizardPanel from "../../assets/DataStudioPreparationWizardPanel";
import DatasetStageAuthoringPanel from "../../assets/DatasetStageAuthoringPanel";
import { useMemo, useState } from "react";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";

interface DatasetStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly hostMode?: StudioAssetRenderMode;
}

const defaultDatasetExperienceAssetIds = Object.freeze([
  ExperienceSurfaceAssetIds.loomWizard,
  ExperienceSurfaceAssetIds.loomCanvas,
]);

function buildDatasetExperienceDefinition(
  experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>,
): ExperienceAssetDefinition<string, never> {
  const fallbackModes = Object.freeze([
    Object.freeze({
      id: ExperienceAssetModeIds.wizard,
      title: "Wizard",
      summary: "Step-by-step data preparation setup.",
      intent: "guided-authoring" as const,
    }),
    Object.freeze({
      id: ExperienceAssetModeIds.canvas,
      title: "Canvas",
      summary: "Visual stage flow editing.",
      intent: "graph-authoring" as const,
    }),
  ]);

  const enabledModeIds = new Set(resolveExperienceAssetModesFromRegistrations({
    assetIds: experienceAssetIds,
    fallbackModes,
  }).map((mode) => mode.id));
  const modes = fallbackModes.filter((mode) => enabledModeIds.has(mode.id));
  const hasWizard = modes.some((mode) => mode.id === ExperienceAssetModeIds.wizard);
  const hasCanvas = modes.some((mode) => mode.id === ExperienceAssetModeIds.canvas);

  return Object.freeze({
    id: "dataset-studio-experience",
    title: "Data Studio",
    defaultModeId: hasWizard ? ExperienceAssetModeIds.wizard : ExperienceAssetModeIds.canvas,
    modes: Object.freeze(modes),
    wizard: hasWizard ? Object.freeze({ id: "wizard", title: "Wizard", summary: "Step-by-step data preparation setup." }) : undefined,
    canvas: hasCanvas ? Object.freeze({ id: "canvas", title: "Canvas", summary: "Visual stage flow editing." }) : undefined,
  });
}

export default function DatasetStudioDraftAuthoringBoundary({
  content,
  extensionContext,
  experienceAssetIds = defaultDatasetExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
}: DatasetStudioDraftAuthoringBoundaryProps): JSX.Element {
  const experienceDefinition = useMemo(
    () => buildDatasetExperienceDefinition(experienceAssetIds),
    [experienceAssetIds],
  );
  const [selectedModeId, setSelectedModeId] = useState<"wizard" | "canvas">(
    hostMode === StudioAssetRenderModes.full
      ? experienceDefinition.defaultModeId as "wizard" | "canvas"
      : "wizard",
  );

  return (
    <ExperienceAssetAuthoringBoundary
      asset={experienceDefinition}
      currentModeId={selectedModeId}
      onModeChange={hostMode === StudioAssetRenderModes.full ? (modeId) => setSelectedModeId(modeId) : undefined}
      document={content}
      issues={[]}
      surfaces={{
        wizard: () => (
          <DataStudioPreparationWizardPanel
            persistedState={content}
            onPipelineStateChange={(serializedState) => extensionContext.operations.setDraftContent?.(serializedState)}
          />
        ),
        canvas: () => <DatasetStageAuthoringPanel mode="canvas" showModeToggle={false} />,
      }}
    />
  );
}
