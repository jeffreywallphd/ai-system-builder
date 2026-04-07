import { useEffect, useMemo, useState } from "react";
import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { ProjectedField } from "../../../application/projection/models/ProjectedField";

interface ContextPackageReference {
  readonly packageId: string;
  readonly alias?: string;
  readonly version?: string;
  readonly includeFragmentIds?: ReadonlyArray<string>;
  readonly excludeFragmentIds?: ReadonlyArray<string>;
  readonly isEnabled?: boolean;
}

function toReferences(value: unknown): ReadonlyArray<ContextPackageReference> {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, ContextPackageReference>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const packageId = typeof record.packageId === "string" ? record.packageId.trim() : "";
    if (!packageId || deduped.has(packageId)) {
      continue;
    }

    const normalizeArray = (candidate: unknown): ReadonlyArray<string> | undefined => {
      if (!Array.isArray(candidate)) {
        return undefined;
      }

      const values = [...new Set(candidate.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
      return values.length > 0 ? values : undefined;
    };

    deduped.set(packageId, {
      packageId,
      alias: typeof record.alias === "string" ? record.alias.trim() || undefined : undefined,
      version: typeof record.version === "string" ? record.version.trim() || undefined : undefined,
      includeFragmentIds: normalizeArray(record.includeFragmentIds),
      excludeFragmentIds: normalizeArray(record.excludeFragmentIds),
      isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : true,
    });
  }

  return [...deduped.values()];
}

function splitCommaSeparated(value: string): ReadonlyArray<string> | undefined {
  const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  return values.length > 0 ? values : undefined;
}

function moveReference(
  references: ReadonlyArray<ContextPackageReference>,
  index: number,
  direction: -1 | 1
): ReadonlyArray<ContextPackageReference> {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= references.length) {
    return references;
  }

  const next = [...references];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function resolvePackageOptionLabel(contextPackage: IContextPackageSummary): string {
  return contextPackage.version
    ? `${contextPackage.name} (${contextPackage.id} · ${contextPackage.version})`
    : `${contextPackage.name} (${contextPackage.id})`;
}

export default function ContextPackageReferenceFieldEditor({
  field,
  onChange,
  availableContextPackages,
}: {
  readonly field: ProjectedField;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
}): JSX.Element {
  const references = toReferences(field.value);
  const packageSummaries = availableContextPackages ?? [];
  const availablePackageOptions = useMemo(
    () =>
      packageSummaries
        .map((contextPackage) => ({
          label: resolvePackageOptionLabel(contextPackage),
          value: contextPackage.id,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [packageSummaries]
  );
  const unboundPackageOptions = useMemo(
    () => availablePackageOptions.filter((option) => !references.some((reference) => reference.packageId === option.value)),
    [availablePackageOptions, references]
  );
  const [newPackageId, setNewPackageId] = useState(unboundPackageOptions[0]?.value ?? "");

  useEffect(() => {
    setNewPackageId((current) => {
      if (current && unboundPackageOptions.some((option) => option.value === current)) {
        return current;
      }

      return unboundPackageOptions[0]?.value ?? "";
    });
  }, [unboundPackageOptions]);

  const updateReferences = (nextValue: ReadonlyArray<ContextPackageReference>): void => {
    onChange(field.id, nextValue);
  };

  const updateReference = (index: number, patch: Partial<ContextPackageReference>): void => {
    const nextValue = references.map((reference, currentIndex) => {
      if (currentIndex !== index) {
        return reference;
      }

      return {
        ...reference,
        ...patch,
        packageId: patch.packageId?.trim() || reference.packageId,
      };
    });
    updateReferences(nextValue);
  };

  const removeReference = (index: number): void => {
    updateReferences(references.filter((_reference, currentIndex) => currentIndex !== index));
  };

  const addReference = (): void => {
    if (!newPackageId) {
      return;
    }

    const selectedSummary = packageSummaries.find((contextPackage) => contextPackage.id === newPackageId);
    updateReferences([
      ...references,
      {
        packageId: newPackageId,
        alias: selectedSummary?.name,
        version: selectedSummary?.version,
        isEnabled: true,
      },
    ]);
  };

  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <label className="ui-field__label">{field.label}</label>
          {field.description ? <div className="ui-field__hint">{field.description}</div> : null}
        </div>

        {references.length === 0 ? <div className="ui-subtle">No context packages configured yet.</div> : null}

        {references.map((reference, index) => {
          const packageOptions = availablePackageOptions.filter(
            (option) => option.value === reference.packageId || !references.some((entry) => entry.packageId === option.value)
          );

          return (
            <div key={`${field.id}-${reference.packageId}`} className="ui-card ui-subtle">
              <div className="ui-card__body ui-stack ui-stack--xs">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <strong>Package {index + 1}</strong>
                  <div className="ui-row ui-row--wrap">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={index === 0}
                      onClick={() => updateReferences(moveReference(references, index, -1))}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={index === references.length - 1}
                      onClick={() => updateReferences(moveReference(references, index, 1))}
                    >
                      Move down
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => removeReference(index)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Package</label>
                  {packageOptions.length > 0 ? (
                    <select
                      className="ui-select"
                      value={reference.packageId}
                      onChange={(event) => updateReference(index, { packageId: event.target.value })}
                    >
                      {packageOptions.map((option) => (
                        <option key={`${field.id}-${reference.packageId}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="ui-input"
                      type="text"
                      value={reference.packageId}
                      onChange={(event) => updateReference(index, { packageId: event.target.value })}
                    />
                  )}
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Alias</label>
                  <input
                    className="ui-input"
                    type="text"
                    value={reference.alias ?? ""}
                    onChange={(event) => updateReference(index, { alias: event.target.value || undefined })}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Version</label>
                  <input
                    className="ui-input"
                    type="text"
                    value={reference.version ?? ""}
                    onChange={(event) => updateReference(index, { version: event.target.value || undefined })}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Include fragment IDs</label>
                  <input
                    className="ui-input"
                    type="text"
                    placeholder="fragment-a, fragment-b"
                    value={(reference.includeFragmentIds ?? []).join(", ")}
                    onChange={(event) => updateReference(index, { includeFragmentIds: splitCommaSeparated(event.target.value) })}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Exclude fragment IDs</label>
                  <input
                    className="ui-input"
                    type="text"
                    placeholder="fragment-c, fragment-d"
                    value={(reference.excludeFragmentIds ?? []).join(", ")}
                    onChange={(event) => updateReference(index, { excludeFragmentIds: splitCommaSeparated(event.target.value) })}
                  />
                </div>

                <label className="ui-row ui-row--wrap">
                  <input
                    className="ui-checkbox"
                    type="checkbox"
                    checked={reference.isEnabled !== false}
                    onChange={(event) => updateReference(index, { isEnabled: event.target.checked })}
                  />
                  <span className="ui-text-body">Enabled for default selection and assembly</span>
                </label>
              </div>
            </div>
          );
        })}

        <div className="ui-stack ui-stack--xs">
          <div className="ui-field">
            <label className="ui-field__label">Attach context package</label>
            {unboundPackageOptions.length > 0 ? (
              <select
                className="ui-select"
                value={newPackageId}
                onChange={(event) => setNewPackageId(event.target.value)}
              >
                {unboundPackageOptions.map((option) => (
                  <option key={`${field.id}-new-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="ui-input"
                type="text"
                placeholder="No more saved packages available"
                value=""
                disabled
                readOnly
              />
            )}
          </div>

          <div>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={addReference}
              disabled={!newPackageId}
            >
              Add context package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
