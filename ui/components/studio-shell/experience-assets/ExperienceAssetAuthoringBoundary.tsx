import type {
  ExperienceAssetActionDefinition,
  ExperienceAssetDefinition,
  ExperienceAssetModeDefinition,
  ExperienceAssetModeId,
} from "../../../studio-shell/experience-assets/ExperienceAssetContracts";

export interface ExperienceAssetModeSurfaceProps<TDocument, TIssue> {
  readonly asset: ExperienceAssetDefinition<TDocument, TIssue>;
  readonly mode: ExperienceAssetModeDefinition;
  readonly document: TDocument;
  readonly issues: ReadonlyArray<TIssue>;
  readonly actions: ReadonlyArray<ExperienceAssetActionDefinition<TDocument, TIssue>>;
}

export interface ExperienceAssetAuthoringBoundaryProps<TDocument, TIssue> {
  readonly asset: ExperienceAssetDefinition<TDocument, TIssue>;
  readonly activeModeId?: ExperienceAssetModeId;
  readonly invalidModeId?: string;
  readonly document: TDocument;
  readonly issues: ReadonlyArray<TIssue>;
  readonly actions?: ReadonlyArray<ExperienceAssetActionDefinition<TDocument, TIssue>>;
  readonly surfaces?: {
    readonly wizard?: (props: ExperienceAssetModeSurfaceProps<TDocument, TIssue>) => JSX.Element;
    readonly canvas?: (props: ExperienceAssetModeSurfaceProps<TDocument, TIssue>) => JSX.Element;
  };
}

export default function ExperienceAssetAuthoringBoundary<TDocument, TIssue>({
  asset,
  activeModeId,
  invalidModeId,
  document,
  issues,
  actions = [],
  surfaces,
}: ExperienceAssetAuthoringBoundaryProps<TDocument, TIssue>): JSX.Element {
  const selectedModeId = activeModeId ?? asset.defaultModeId;
  const selectedMode = asset.modes.find((mode) => mode.id === selectedModeId)
    ?? asset.modes.find((mode) => mode.id === asset.defaultModeId)
    ?? asset.modes[0];

  if (!selectedMode) {
    return <p className="ui-text-muted">No authoring modes are configured for this experience asset.</p>;
  }

  const surfaceProps = {
    asset,
    mode: selectedMode,
    document,
    issues,
    actions,
  } satisfies ExperienceAssetModeSurfaceProps<TDocument, TIssue>;

  const activeSurface = selectedMode.id === "wizard"
    ? surfaces?.wizard
    : surfaces?.canvas;

  return (
    <>
      {activeSurface
        ? activeSurface(surfaceProps)
        : <p className="ui-text-muted">{selectedMode.title} mode is not wired yet for this experience asset.</p>}

      {invalidModeId ? (
        <p className="ui-text-muted">
          Unsupported experience mode route &quot;{invalidModeId}&quot;; using {selectedMode.id} mode.
        </p>
      ) : null}
    </>
  );
}
