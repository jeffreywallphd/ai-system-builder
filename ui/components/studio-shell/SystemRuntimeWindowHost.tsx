import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { StudioShellSnapshotReadModel } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type SystemRuntimeWindowLaunchContract,
} from "../../../application/system-runtime/SystemRuntimeWindowLaunchContract";
import {
  SystemRuntimeWindowHydrationService,
  type SystemRuntimeHydratedState,
} from "../../runtime/SystemRuntimeWindowHydrationService";
import ImageManipulationRuntimeEditorPanel from "./ImageManipulationRuntimeEditorPanel";
import { imageManipulationEditorPageAssetDefinition } from "../../studio-shell/studio-assets/ImageManipulationEditorPageAsset";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";

interface RuntimePageRendererEntry {
  readonly render: (
    context: StudioShellExtensionContext,
    launch: SystemRuntimeWindowLaunchContract,
    hydratedRuntime?: SystemRuntimeHydratedState,
  ) => JSX.Element;
}

const runtimePageRenderers: Readonly<Record<string, RuntimePageRendererEntry>> = Object.freeze({
  [imageManipulationEditorPageAssetDefinition.contract.identity.studioType]: Object.freeze({
    render: (context, launch, hydratedRuntime) => (
      <ImageManipulationRuntimeEditorPanel
        context={context}
        runtimeLaunch={launch}
        hydratedRuntime={hydratedRuntime}
      />
    ),
  }),
});

function parseLaunchContractFromSearch(search: string): {
  readonly launchContract?: SystemRuntimeWindowLaunchContract;
  readonly issue?: string;
} {
  const serialized = new URLSearchParams(search).get(SystemRuntimeWindowLaunchQueryParam);
  if (!serialized) {
    return Object.freeze({
      issue: "runtime-window.launch-contract.query-missing",
    });
  }
  const parsed = parseSystemRuntimeWindowLaunchContract(serialized);
  if (!parsed) {
    return Object.freeze({
      issue: "runtime-window.launch-contract.invalid",
    });
  }
  return Object.freeze({
    launchContract: parsed,
  });
}

export default function SystemRuntimeWindowHost(): JSX.Element {
  const location = useLocation();
  const service = useMemo(() => new StudioShellService(), []);
  const hydrationService = useMemo(() => new SystemRuntimeWindowHydrationService(), []);
  const parsedLaunch = useMemo(
    () => parseLaunchContractFromSearch(location.search),
    [location.search],
  );
  const launchContract = parsedLaunch.launchContract;
  const [snapshot, setSnapshot] = useState<StudioShellSnapshotReadModel | undefined>();
  const [hydratedRuntime, setHydratedRuntime] = useState<SystemRuntimeHydratedState | undefined>();
  const [hydrationIssues, setHydrationIssues] = useState<ReadonlyArray<{ readonly code: string; readonly message: string; readonly severity: "warning" | "error"; readonly path?: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refreshSnapshot = async (): Promise<void> => {
    if (!launchContract) {
      return;
    }
    const response = await service.loadSnapshot(launchContract.resolution.studioId);
    if (!response.ok) {
      const hydration = hydrationService.hydrate({ launchContract });
      setHydratedRuntime(hydration.state);
      setHydrationIssues(hydration.issues);
      setError(response.error?.message
        ?? hydration.issues.find((issue) => issue.severity === "error")?.message
        ?? "Unable to load runtime window studio state.");
      return;
    }
    setSnapshot(response.data);
    const hydration = hydrationService.hydrate({
      launchContract,
      snapshot: response.data,
    });
    setHydratedRuntime(hydration.state);
    setHydrationIssues(hydration.issues);
    setError(hydration.issues.find((issue) => issue.severity === "error")?.message);
  };

  useEffect(() => {
    if (!launchContract) {
      setHydratedRuntime(undefined);
      setHydrationIssues([]);
      setError(
        parsedLaunch.issue === "runtime-window.launch-contract.query-missing"
          ? "Runtime launch data is missing."
          : "Runtime launch data is invalid.",
      );
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
  }, [launchContract?.launchId, parsedLaunch.issue]);

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
      {hydrationIssues.length > 0 ? (
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Runtime hydration</strong>
          {hydrationIssues.map((issue) => (
            <span key={`${issue.code}:${issue.path ?? ""}`} className="ui-text-small ui-text-secondary">
              [{issue.severity}] {issue.message}
            </span>
          ))}
          <details>
            <summary className="ui-text-small ui-text-secondary">Hydration details</summary>
            <pre className="ui-text-small">{JSON.stringify({
              launchId: launchContract.launchId,
              resolvedSystemAssetId: hydratedRuntime?.resolvedSystemAsset.assetId,
              resolvedPageBindingId: hydratedRuntime?.resolvedPage.pageBindingId,
              datasetBindingIds: hydratedRuntime?.datasetBindings.map((entry) => entry.bindingId),
              issueCodes: hydrationIssues.map((issue) => issue.code),
            }, null, 2)}</pre>
          </details>
        </div>
      ) : null}
      {renderer.render(extensionContext, launchContract, hydratedRuntime)}
    </section>
  );
}
