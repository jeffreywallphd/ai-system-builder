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

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const packageId = typeof record.packageId === "string" ? record.packageId.trim() : "";
    if (!packageId) {
      return [];
    }

    const normalizeArray = (candidate: unknown): ReadonlyArray<string> | undefined => {
      if (!Array.isArray(candidate)) {
        return undefined;
      }

      const values = candidate
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      return values.length > 0 ? values : undefined;
    };

    return [
      {
        packageId,
        alias: typeof record.alias === "string" ? record.alias.trim() || undefined : undefined,
        version: typeof record.version === "string" ? record.version.trim() || undefined : undefined,
        includeFragmentIds: normalizeArray(record.includeFragmentIds),
        excludeFragmentIds: normalizeArray(record.excludeFragmentIds),
        isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : true,
      },
    ];
  });
}

function splitCommaSeparated(value: string): ReadonlyArray<string> | undefined {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export default function ContextPackageReferenceFieldEditor({
  field,
  onChange,
}: {
  readonly field: ProjectedField;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  const references = toReferences(field.value);

  const updateReference = (index: number, patch: Partial<ContextPackageReference>): void => {
    const nextValue = references.map((reference, currentIndex) =>
      currentIndex === index ? { ...reference, ...patch } : reference
    );
    onChange(field.id, nextValue);
  };

  const removeReference = (index: number): void => {
    onChange(
      field.id,
      references.filter((_reference, currentIndex) => currentIndex !== index)
    );
  };

  const addReference = (): void => {
    const packageId = typeof window !== "undefined"
      ? window.prompt("Context package ID")?.trim() ?? ""
      : "";

    if (!packageId) {
      return;
    }

    onChange(field.id, [...references, { packageId, alias: packageId, isEnabled: true }]);
  };

  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <label className="ui-field__label">{field.label}</label>
          {field.description ? <div className="ui-field__hint">{field.description}</div> : null}
        </div>

        {references.length === 0 ? <div className="ui-subtle">No context packages configured yet.</div> : null}

        {references.map((reference, index) => (
          <div key={`${field.id}-${index}`} className="ui-card ui-subtle">
            <div className="ui-card__body ui-stack ui-stack--xs">
              <div className="ui-row ui-row--between ui-row--wrap">
                <strong>Package {index + 1}</strong>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => removeReference(index)}>
                  Remove
                </button>
              </div>

              <div className="ui-field">
                <label className="ui-field__label">Package ID</label>
                <input
                  className="ui-input"
                  type="text"
                  value={reference.packageId}
                  onChange={(event) => updateReference(index, { packageId: event.target.value })}
                />
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
                  value={(reference.includeFragmentIds ?? []).join(", ")}
                  onChange={(event) => updateReference(index, { includeFragmentIds: splitCommaSeparated(event.target.value) })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-field__label">Exclude fragment IDs</label>
                <input
                  className="ui-input"
                  type="text"
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
                <span className="ui-text-body">Enabled for assembly</span>
              </label>
            </div>
          </div>
        ))}

        <div>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={addReference}>
            Add context package
          </button>
        </div>
      </div>
    </div>
  );
}
