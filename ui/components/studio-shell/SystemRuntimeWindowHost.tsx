import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { StudioShellSnapshotReadModel } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type SystemRuntimeWindowLaunchContract,
} from "../../../application/system-runtime/SystemRuntimeWindowLaunchContract";
import ImageManipulationRuntimeEditorPanel from "./ImageManipulationRuntimeEditorPanel";
import { imageManipulationEditorPageAssetDefinition } from "../../studio-shell/studio-assets/ImageManipulationEditorPageAsset";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";

interface RuntimePageRendererEntry {
  readonly render: (context: StudioShellExtensionContext, launch: SystemRuntimeWindowLaunchContract) => JSX.Element;
}

const runtimePageRenderers: Readonly<Record<string, RuntimePageRendererEntry>> = Object.freeze({
  [imageManipulationEditorPageAssetDefinition.contract.identity.studioType]: Object.freeze({
    render: (context, launch) => <ImageManipulationRuntimeEditorPanel context={context} runtimeLaunch={launch} />,
  }),
});

function parseLaunchContractFromSearch(search: string): SystemRuntimeWindowLaunchContract | undefined {
  const serialized = new URLSearchParams(search).get(SystemRuntimeWindowLaunchQueryParam);
  if (!serialized) {
    return undefined;
  }
  return parseSystemRuntimeWindowLaunchContract(serialized);
}

export default function SystemRuntimeWindowHost(): JSX.Element {
  const location = useLocation();
  const service = useMemo(() => new StudioShellService(), []);
  const launchContract = useMemo(
    () => parseLaunchContractFromSearch(location.search),
    [location.search],
  );
  const [snapshot, setSnapshot] = useState<StudioShellSnapshotReadModel | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refreshSnapshot = async (): Promise<void> => {
    if (!launchContract) {
      return;
    }
    const response = await service.loadSnapshot(launchContract.resolution.studioId);
    if (!response.ok) {
      setError(response.error?.message ?? "Unable to load runtime window studio state.");
      return;
    }
    setSnapshot(response.data);
    setError(undefined);
  };

  useEffect(() => {
    if (!launchContract) {
      setError("Runtime launch data is missing or invalid.");
      return;
    }
    let cancelled = false;
    setIsBusy(true);
    void refreshSnapshot()
      .finally(() => {
        if (!cancelled) {
          setIsBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [launchContract?.launchId]);

  if (!launchContract) {
    return (
      <section className="ui-page ui-stack ui-stack--md">
        <div className="ui-card ui-card--padded">
          <h1 className="ui-page__title">Runtime window unavailable</h1>
          <p className="ui-page__subtitle">This window requires a valid runtime launch contract.</p>
        </div>
      </section>
    );
  }

  const renderer = runtimePageRenderers[launchContract.launchTarget.pageBindingId];
  if (!renderer) {
    return (
      <section className="ui-page ui-stack ui-stack--md">
        <div className="ui-card ui-card--padded">
          <h1 className="ui-page__title">Unsupported runtime page</h1>
          <p className="ui-page__subtitle">
            No renderer is currently registered for page binding "{launchContract.launchTarget.pageBindingId}".
          </p>
        </div>
      </section>
    );
  }

  const extensionContext: StudioShellExtensionContext = {
    studioId: launchContract.resolution.studioId,
    snapshot,
    validationIssues: snapshot?.validationIssues ?? [],
    handoffContext: {
      assetId: launchContract.launchTarget.systemAssetId,
      versionId: launchContract.launchTarget.systemAssetVersionId,
      selectedComponent: launchContract.launchTarget.subsystemId,
    },
    operationError: error,
    isBusy,
    operations: {
      refresh: refreshSnapshot,
      startSystemExecution: async (request) => service.startSystemExecution(request),
      getSystemExecutionStatus: async (executionId) => service.getSystemExecutionStatus(executionId),
      getSystemExecutionTrace: async (request) => service.getSystemExecutionTrace(request),
      getSystemExecutionResult: async (executionId) => service.getSystemExecutionResult(executionId),
    },
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="system-runtime-window-host">
      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <strong>Runtime window</strong>
        <span className="ui-text-small ui-text-secondary">
          Launch {launchContract.launchId} | target {launchContract.launchTarget.targetKind}
        </span>
      </div>
      {renderer.render(extensionContext, launchContract)}
    </section>
  );
}
