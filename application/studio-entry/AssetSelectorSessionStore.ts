import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  type AssetSelectorAssetReference,
  type AssetSelectorContext,
  type AssetSelectorRequest,
  type AssetSelectorResult,
} from "../../domain/studio-shell/AssetSelectorContract";
import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import {
  AssetSelectorApplicationValidationService,
  createDefaultAssetSelectorCapabilityRegistry,
} from "./AssetSelectorCapabilityRegistry";

export const AssetSelectorSessionLifecycleStates = Object.freeze({
  idle: "idle",
  active: "active",
  creatingNew: "creating-new",
  returning: "returning",
  cancelled: "cancelled",
  completed: "completed",
});

export type AssetSelectorSessionLifecycleState =
  typeof AssetSelectorSessionLifecycleStates[keyof typeof AssetSelectorSessionLifecycleStates];

export const AssetSelectorSessionErrorCodes = Object.freeze({
  validationFailed: "validation-failed",
  returnPayloadInvalid: "return-payload-invalid",
  restorationFailed: "restoration-failed",
  sessionNotFound: "session-not-found",
  assetTypeMismatch: "asset-type-mismatch",
});

export type AssetSelectorSessionErrorCode =
  typeof AssetSelectorSessionErrorCodes[keyof typeof AssetSelectorSessionErrorCodes];

export interface AssetSelectorSessionError {
  readonly code: AssetSelectorSessionErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface AssetSelectorCreatingNewContext {
  readonly originatingContext: AssetSelectorContext;
  readonly requestedAssetType: TaxonomySemanticRole;
  readonly returnTargetSessionKey: string;
  readonly returnRoutePath?: string;
}

export interface AssetSelectorSessionState {
  readonly sessionKey: string;
  readonly request: AssetSelectorRequest;
  readonly lifecycleState: AssetSelectorSessionLifecycleState;
  readonly selectedAssets: ReadonlyArray<AssetSelectorAssetReference>;
  readonly pendingSelections: ReadonlyArray<AssetSelectorAssetReference>;
  readonly validationErrors: ReadonlyArray<AssetSelectorSessionError>;
  readonly lastResult?: AssetSelectorResult;
  readonly creatingNewContext?: AssetSelectorCreatingNewContext;
  readonly lifecycleHistory: ReadonlyArray<AssetSelectorSessionLifecycleState>;
}

export interface AssetSelectorSessionSnapshot {
  readonly sessionKey: string;
  readonly request: AssetSelectorRequest;
  readonly lifecycleState: AssetSelectorSessionLifecycleState;
  readonly selectedAssets: ReadonlyArray<AssetSelectorAssetReference>;
  readonly pendingSelections: ReadonlyArray<AssetSelectorAssetReference>;
  readonly lastResult?: AssetSelectorResult;
  readonly creatingNewContext?: AssetSelectorCreatingNewContext;
}

export type AssetSelectorSessionListener = (state: AssetSelectorSessionState) => void;

function dedupeAssetReferences(
  assets: ReadonlyArray<AssetSelectorAssetReference>,
): ReadonlyArray<AssetSelectorAssetReference> {
  const byIdentity = new Map<string, AssetSelectorAssetReference>();
  for (const asset of assets) {
    const key = `${asset.assetId}::${asset.versionId ?? ""}`;
    byIdentity.set(key, Object.freeze({
      assetId: asset.assetId,
      versionId: asset.versionId,
      assetType: asset.assetType,
      displayName: asset.displayName,
      taxonomy: asset.taxonomy,
    }));
  }
  return Object.freeze([...byIdentity.values()]);
}

function normalizeSelectionsForMode(
  request: AssetSelectorRequest,
  assets: ReadonlyArray<AssetSelectorAssetReference>,
): ReadonlyArray<AssetSelectorAssetReference> {
  const deduped = dedupeAssetReferences(assets);
  if (request.selectionMode === AssetSelectorSelectionModes.singleSelect) {
    const selected = deduped[0];
    return Object.freeze(selected ? [selected] : []);
  }
  return deduped;
}

function buildValidationErrors(
  message: string,
  code: AssetSelectorSessionErrorCode = AssetSelectorSessionErrorCodes.validationFailed,
  path?: string,
): ReadonlyArray<AssetSelectorSessionError> {
  return Object.freeze([Object.freeze({
    code,
    message,
    path,
  })]);
}

function mergeSelectedAssets(
  request: AssetSelectorRequest,
  existing: ReadonlyArray<AssetSelectorAssetReference>,
  incoming: ReadonlyArray<AssetSelectorAssetReference>,
): ReadonlyArray<AssetSelectorAssetReference> {
  if (request.selectionMode === AssetSelectorSelectionModes.singleSelect) {
    const selected = incoming[0] ?? existing[0];
    return Object.freeze(selected ? [selected] : []);
  }
  return dedupeAssetReferences([...existing, ...incoming]);
}

export class AssetSelectorSessionStore {
  private readonly sessionStates = new Map<string, AssetSelectorSessionState>();
  private readonly listenersBySessionKey = new Map<string, Set<AssetSelectorSessionListener>>();
  private readonly validator: AssetSelectorApplicationValidationService;

  public constructor(
    validator = new AssetSelectorApplicationValidationService(createDefaultAssetSelectorCapabilityRegistry()),
  ) {
    this.validator = validator;
  }

  public prepareSession(input: {
    readonly sessionKey: string;
    readonly request: AssetSelectorRequest;
    readonly initialSelectedAssets?: ReadonlyArray<AssetSelectorAssetReference>;
  }): AssetSelectorSessionState {
    const request = this.validator.assertValidRequest(input.request);
    const selectedAssets = normalizeSelectionsForMode(
      request,
      input.initialSelectedAssets?.filter((entry) => entry.assetType === request.assetType) ?? [],
    );
    const state: AssetSelectorSessionState = Object.freeze({
      sessionKey: input.sessionKey.trim(),
      request,
      lifecycleState: AssetSelectorSessionLifecycleStates.idle,
      selectedAssets,
      pendingSelections: selectedAssets,
      validationErrors: Object.freeze([]),
      lastResult: undefined,
      creatingNewContext: undefined,
      lifecycleHistory: Object.freeze([AssetSelectorSessionLifecycleStates.idle]),
    });
    this.sessionStates.set(state.sessionKey, state);
    this.emit(state.sessionKey);
    return state;
  }

  public activateSession(sessionKey: string): AssetSelectorSessionState {
    return this.patch(sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.active,
      validationErrors: Object.freeze([]),
    });
  }

  public transitionToCreatingNew(
    sessionKey: string,
    creatingNewContext?: AssetSelectorCreatingNewContext,
  ): AssetSelectorSessionState {
    return this.patch(sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.creatingNew,
      validationErrors: Object.freeze([]),
      creatingNewContext: creatingNewContext ?? this.requireSession(sessionKey).creatingNewContext,
    });
  }

  public resumeAfterCreationCancellation(sessionKey: string, reason = "creation-cancelled"): AssetSelectorSessionState {
    const state = this.requireSession(sessionKey);
    return this.patch(sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.active,
      pendingSelections: state.selectedAssets,
      validationErrors: Object.freeze([]),
      lastResult: Object.freeze({
        kind: AssetSelectorResultKinds.cancelled,
        reason,
      }),
    });
  }

  public cancelSession(sessionKey: string, reason = "cancelled"): AssetSelectorSessionState {
    return this.patch(sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.cancelled,
      validationErrors: buildValidationErrors(reason, AssetSelectorSessionErrorCodes.validationFailed),
      pendingSelections: this.requireSession(sessionKey).selectedAssets,
      lastResult: Object.freeze({
        kind: AssetSelectorResultKinds.cancelled,
        reason,
      }),
    });
  }

  public togglePendingSelection(sessionKey: string, selection: AssetSelectorAssetReference): AssetSelectorSessionState {
    const state = this.requireSession(sessionKey);
    if (selection.assetType !== state.request.assetType) {
      return this.patch(sessionKey, {
        validationErrors: buildValidationErrors(
          `Selected asset type '${selection.assetType}' does not match request asset type '${state.request.assetType}'.`,
          AssetSelectorSessionErrorCodes.assetTypeMismatch,
        ),
      });
    }

    const existing = state.pendingSelections.find((entry) => entry.assetId === selection.assetId);
    const nextPending = existing
      ? state.pendingSelections.filter((entry) => entry.assetId !== selection.assetId)
      : [...state.pendingSelections, selection];
    return this.patch(sessionKey, {
      pendingSelections: normalizeSelectionsForMode(state.request, nextPending),
      validationErrors: Object.freeze([]),
    });
  }

  public clearPendingSelections(sessionKey: string): AssetSelectorSessionState {
    return this.patch(sessionKey, {
      pendingSelections: Object.freeze([]),
      validationErrors: Object.freeze([]),
    });
  }

  public setPendingSelections(
    sessionKey: string,
    selections: ReadonlyArray<AssetSelectorAssetReference>,
  ): AssetSelectorSessionState {
    const state = this.requireSession(sessionKey);
    const mismatchedSelection = selections.find((entry) => entry.assetType !== state.request.assetType);
    if (mismatchedSelection) {
      return this.patch(sessionKey, {
        validationErrors: buildValidationErrors(
          `Selected asset type '${mismatchedSelection.assetType}' does not match request asset type '${state.request.assetType}'.`,
          AssetSelectorSessionErrorCodes.assetTypeMismatch,
        ),
      });
    }
    return this.patch(sessionKey, {
      pendingSelections: normalizeSelectionsForMode(state.request, selections),
      validationErrors: Object.freeze([]),
    });
  }

  public replaceSelections(
    sessionKey: string,
    selections: ReadonlyArray<AssetSelectorAssetReference>,
  ): AssetSelectorSessionState {
    const state = this.requireSession(sessionKey);
    const mismatchedSelection = selections.find((entry) => entry.assetType !== state.request.assetType);
    if (mismatchedSelection) {
      return this.patch(sessionKey, {
        validationErrors: buildValidationErrors(
          `Selected asset type '${mismatchedSelection.assetType}' does not match request asset type '${state.request.assetType}'.`,
          AssetSelectorSessionErrorCodes.assetTypeMismatch,
        ),
      });
    }
    const normalizedSelections = normalizeSelectionsForMode(state.request, selections);
    return this.patch(sessionKey, {
      selectedAssets: normalizedSelections,
      pendingSelections: normalizedSelections,
      validationErrors: Object.freeze([]),
    });
  }

  public confirmPendingSelections(sessionKey: string): AssetSelectorSessionState {
    const state = this.requireSession(sessionKey);
    return this.handleReturnPayload({
      sessionKey,
      result: Object.freeze({
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: state.pendingSelections,
      }),
    });
  }

  public handleReturnPayload(input: {
    readonly sessionKey: string;
    readonly result: AssetSelectorResult;
  }): AssetSelectorSessionState {
    const current = this.requireSession(input.sessionKey);
    this.patch(input.sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.returning,
      validationErrors: Object.freeze([]),
    });

    const validation = this.validator.validateResult({
      request: current.request,
      result: input.result,
    });

    if (!validation.valid) {
      return this.patch(input.sessionKey, {
        lifecycleState: AssetSelectorSessionLifecycleStates.active,
        validationErrors: Object.freeze(validation.issues.map((issue) => Object.freeze({
          code: AssetSelectorSessionErrorCodes.returnPayloadInvalid,
          message: issue.message,
          path: issue.path,
        }))),
      });
    }

    if (input.result.kind === AssetSelectorResultKinds.cancelled) {
      return this.patch(input.sessionKey, {
        lifecycleState: AssetSelectorSessionLifecycleStates.cancelled,
        pendingSelections: current.selectedAssets,
        lastResult: Object.freeze(input.result),
        validationErrors: Object.freeze([]),
      });
    }

    const merged = mergeSelectedAssets(current.request, current.selectedAssets, input.result.assets);
    return this.patch(input.sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.completed,
      selectedAssets: merged,
      pendingSelections: merged,
      validationErrors: Object.freeze([]),
      lastResult: Object.freeze(input.result),
    });
  }

  public reportReturnPayloadError(
    sessionKey: string,
    message: string,
    path?: string,
  ): AssetSelectorSessionState {
    return this.patch(sessionKey, {
      lifecycleState: AssetSelectorSessionLifecycleStates.active,
      validationErrors: buildValidationErrors(
        message,
        AssetSelectorSessionErrorCodes.returnPayloadInvalid,
        path,
      ),
    });
  }

  public getSession(sessionKey: string): AssetSelectorSessionState | undefined {
    return this.sessionStates.get(sessionKey.trim());
  }

  public listSessions(): ReadonlyArray<AssetSelectorSessionState> {
    return Object.freeze([...this.sessionStates.values()]);
  }

  public createNavigationSnapshot(sessionKey: string): AssetSelectorSessionSnapshot {
    const state = this.requireSession(sessionKey);
    return Object.freeze({
      sessionKey: state.sessionKey,
      request: state.request,
      lifecycleState: state.lifecycleState,
      selectedAssets: state.selectedAssets,
      pendingSelections: state.pendingSelections,
      lastResult: state.lastResult,
      creatingNewContext: state.creatingNewContext,
    });
  }

  public restoreFromSnapshot(snapshot: AssetSelectorSessionSnapshot): {
    readonly restored: boolean;
    readonly error?: AssetSelectorSessionError;
    readonly state?: AssetSelectorSessionState;
  } {
    try {
      const request = this.validator.assertValidRequest(snapshot.request);
      const selectedAssets = normalizeSelectionsForMode(request, snapshot.selectedAssets ?? []);
      const pendingSelections = normalizeSelectionsForMode(request, snapshot.pendingSelections ?? selectedAssets);
      const state: AssetSelectorSessionState = Object.freeze({
        sessionKey: snapshot.sessionKey.trim(),
        request,
        lifecycleState: snapshot.lifecycleState,
        selectedAssets,
        pendingSelections,
        validationErrors: Object.freeze([]),
        lastResult: snapshot.lastResult,
        creatingNewContext: snapshot.creatingNewContext,
        lifecycleHistory: Object.freeze([AssetSelectorSessionLifecycleStates.idle, snapshot.lifecycleState]),
      });
      this.sessionStates.set(state.sessionKey, state);
      this.emit(state.sessionKey);
      return Object.freeze({
        restored: true,
        state,
      });
    } catch (error) {
      const issue: AssetSelectorSessionError = Object.freeze({
        code: AssetSelectorSessionErrorCodes.restorationFailed,
        message: error instanceof Error ? error.message : "Failed to restore selector session from snapshot.",
      });
      return Object.freeze({
        restored: false,
        error: issue,
      });
    }
  }

  public subscribe(sessionKey: string, listener: AssetSelectorSessionListener): () => void {
    const key = sessionKey.trim();
    const listeners = this.listenersBySessionKey.get(key) ?? new Set<AssetSelectorSessionListener>();
    listeners.add(listener);
    this.listenersBySessionKey.set(key, listeners);
    const current = this.sessionStates.get(key);
    if (current) {
      listener(current);
    }
    return () => {
      const registered = this.listenersBySessionKey.get(key);
      if (!registered) {
        return;
      }
      registered.delete(listener);
      if (registered.size === 0) {
        this.listenersBySessionKey.delete(key);
      }
    };
  }

  private requireSession(sessionKey: string): AssetSelectorSessionState {
    const state = this.sessionStates.get(sessionKey.trim());
    if (!state) {
      throw new Error(`Asset selector session '${sessionKey}' was not found.`);
    }
    return state;
  }

  private patch(sessionKey: string, patch: Partial<AssetSelectorSessionState>): AssetSelectorSessionState {
    const current = this.requireSession(sessionKey);
    const nextLifecycle = patch.lifecycleState ?? current.lifecycleState;
    const state: AssetSelectorSessionState = Object.freeze({
      ...current,
      ...patch,
      lifecycleHistory: nextLifecycle === current.lifecycleState
        ? current.lifecycleHistory
        : Object.freeze([...current.lifecycleHistory, nextLifecycle]),
    });
    this.sessionStates.set(current.sessionKey, state);
    this.emit(current.sessionKey);
    return state;
  }

  private emit(sessionKey: string): void {
    const listeners = this.listenersBySessionKey.get(sessionKey);
    const state = this.sessionStates.get(sessionKey);
    if (!listeners || !state) {
      return;
    }
    for (const listener of listeners) {
      listener(state);
    }
  }
}
