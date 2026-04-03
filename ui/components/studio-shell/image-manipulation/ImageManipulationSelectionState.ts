export type ImageManipulationSelectionRole = "source" | "output" | "reference";

export interface ImageManipulationSelectionState {
  readonly activePreviewRole: ImageManipulationSelectionRole;
  readonly sourceRecordId?: string;
  readonly outputRecordId?: string;
  readonly referenceRecordId?: string;
}

const rolePriority: ReadonlyArray<ImageManipulationSelectionRole> = Object.freeze([
  "output",
  "source",
  "reference",
]);

export function createInitialImageManipulationSelectionState(): ImageManipulationSelectionState {
  return Object.freeze({
    activePreviewRole: "output",
  });
}

export function getSelectionRecordIdForRole(
  selection: ImageManipulationSelectionState,
  role: ImageManipulationSelectionRole,
): string | undefined {
  if (role === "source") {
    return selection.sourceRecordId;
  }
  if (role === "reference") {
    return selection.referenceRecordId;
  }
  return selection.outputRecordId;
}

export function setActivePreviewRole(
  selection: ImageManipulationSelectionState,
  role: ImageManipulationSelectionRole,
): ImageManipulationSelectionState {
  return Object.freeze({
    ...selection,
    activePreviewRole: role,
  });
}

export function setRoleSelection(
  selection: ImageManipulationSelectionState,
  input: {
    readonly role: ImageManipulationSelectionRole;
    readonly recordId?: string;
    readonly syncPreviewRole?: boolean;
  },
): ImageManipulationSelectionState {
  const next = {
    ...selection,
    activePreviewRole: input.syncPreviewRole === false ? selection.activePreviewRole : input.role,
  };
  if (input.role === "source") {
    return Object.freeze({
      ...next,
      sourceRecordId: input.recordId,
    });
  }
  if (input.role === "reference") {
    return Object.freeze({
      ...next,
      referenceRecordId: input.recordId,
    });
  }
  return Object.freeze({
    ...next,
    outputRecordId: input.recordId,
  });
}

export function resolvePreviewRecordId(selection: ImageManipulationSelectionState): string | undefined {
  return getSelectionRecordIdForRole(selection, selection.activePreviewRole);
}

function resolvePreferredRecordId(
  availableRecordIds: ReadonlyArray<string>,
  existingRecordId?: string,
  preferredRecordId?: string,
): string | undefined {
  if (preferredRecordId && availableRecordIds.includes(preferredRecordId)) {
    return preferredRecordId;
  }
  if (existingRecordId && availableRecordIds.includes(existingRecordId)) {
    return existingRecordId;
  }
  return availableRecordIds[0];
}

function resolveActivePreviewRole(
  requestedRole: ImageManipulationSelectionRole,
  hasItemsByRole: Readonly<Record<ImageManipulationSelectionRole, boolean>>,
): ImageManipulationSelectionRole {
  if (hasItemsByRole[requestedRole]) {
    return requestedRole;
  }
  return rolePriority.find((role) => hasItemsByRole[role]) ?? requestedRole;
}

export function reconcileImageManipulationSelection(
  current: ImageManipulationSelectionState,
  input: {
    readonly sourceRecordIds: ReadonlyArray<string>;
    readonly outputRecordIds: ReadonlyArray<string>;
    readonly referenceRecordIds: ReadonlyArray<string>;
    readonly preferredSourceRecordId?: string;
    readonly preferredOutputRecordId?: string;
    readonly preferredReferenceRecordId?: string;
  },
): ImageManipulationSelectionState {
  const sourceRecordId = resolvePreferredRecordId(
    input.sourceRecordIds,
    current.sourceRecordId,
    input.preferredSourceRecordId,
  );
  const outputRecordId = resolvePreferredRecordId(
    input.outputRecordIds,
    current.outputRecordId,
    input.preferredOutputRecordId,
  );
  const referenceRecordId = resolvePreferredRecordId(
    input.referenceRecordIds,
    current.referenceRecordId,
    input.preferredReferenceRecordId,
  );
  const activePreviewRole = resolveActivePreviewRole(current.activePreviewRole, {
    source: Boolean(sourceRecordId),
    output: Boolean(outputRecordId),
    reference: Boolean(referenceRecordId),
  });

  return Object.freeze({
    activePreviewRole,
    sourceRecordId,
    outputRecordId,
    referenceRecordId,
  });
}
