import { useEffect, useMemo, useState } from "react";
import type { IContextPackage } from "../../../application/context/models/ContextPackage";
import type { IContextFragment } from "../../../application/context/models/ContextFragment";
import type { IContextPackageReference } from "../../../application/context/models/ContextPackageReference";
import ContextFragmentEditor from "./ContextFragmentEditor";

interface ContextPackageDraft {
  readonly id?: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly tagsText: string;
  readonly referenceIdsText: string;
  readonly fragments: ReadonlyArray<IContextFragment>;
}

export interface ContextPackageEditorSubmitDraft {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags: ReadonlyArray<string>;
  readonly references: ReadonlyArray<IContextPackageReference>;
  readonly fragments: ReadonlyArray<IContextFragment>;
}

export interface ContextPackageEditorProps {
  readonly contextPackage?: IContextPackage;
  readonly isSaving?: boolean;
  readonly onCreate?: (draft: ContextPackageEditorSubmitDraft) => void;
  readonly onUpdate?: (contextPackageId: string, draft: ContextPackageEditorSubmitDraft) => void;
  readonly onDelete?: (contextPackageId: string) => void;
}

function createEmptyFragment(order: number): IContextFragment {
  return {
    id: `fragment-${order + 1}`,
    kind: "instructions",
    title: "",
    content: "",
    order,
    metadata: undefined,
  };
}

function toDraft(contextPackage?: IContextPackage): ContextPackageDraft {
  return {
    id: contextPackage?.id,
    name: contextPackage?.name ?? "",
    description: contextPackage?.description ?? "",
    version: contextPackage?.version ?? "",
    tagsText: (contextPackage?.tags ?? []).join(", "),
    referenceIdsText: (contextPackage?.references ?? []).map((reference) => reference.packageId).join(", "),
    fragments: contextPackage?.fragments ?? [createEmptyFragment(0)],
  };
}

function parseList(value: string): ReadonlyArray<string> {
  return Object.freeze([...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]);
}

export default function ContextPackageEditor({
  contextPackage,
  isSaving = false,
  onCreate,
  onUpdate,
  onDelete,
}: ContextPackageEditorProps): JSX.Element {
  const [draft, setDraft] = useState<ContextPackageDraft>(() => toDraft(contextPackage));

  useEffect(() => {
    setDraft(toDraft(contextPackage));
  }, [contextPackage]);

  const sortedFragments = useMemo(
    () => [...draft.fragments].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
    [draft.fragments],
  );

  const payload = useMemo<ContextPackageEditorSubmitDraft>(
    () => ({
      id: draft.id,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      version: draft.version.trim() || undefined,
      tags: parseList(draft.tagsText),
      references: parseList(draft.referenceIdsText).map((packageId) => ({ packageId })),
      fragments: sortedFragments,
    }),
    [draft, sortedFragments],
  );

  return (
    <div className="ui-context-editor">
      <div className="ui-card">
        <div className="ui-card__body ui-context-editor__section">
          <div className="ui-context-editor__header">
            <div>
              <h2>{contextPackage ? "Edit prompt pack" : "Create prompt pack"}</h2>
              <p className="ui-text-secondary">
                Collect reusable instructions, examples, and reference notes in one place for your team.
              </p>
            </div>
            {contextPackage?.id && onDelete ? (
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => onDelete(contextPackage.id)}
                disabled={isSaving}
              >
                Delete pack
              </button>
            ) : null}
          </div>

          <div className="ui-context-grid">
            <label className="ui-field">
              <span className="ui-label">Pack name</span>
              <input className="ui-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>

            <label className="ui-field">
              <span className="ui-label">Version</span>
              <input className="ui-input" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} placeholder="v1" />
            </label>
          </div>

            <label className="ui-field">
              <span className="ui-label">Description</span>
              <textarea
                className="ui-input"
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Explain when this pack should be used."
              />
            </label>

          <div className="ui-context-grid">
            <label className="ui-field">
              <span className="ui-label">Tags</span>
              <input
                className="ui-input"
                value={draft.tagsText}
                onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })}
                placeholder="shared, persona, support"
              />
            </label>

            <label className="ui-field">
              <span className="ui-label">Related packs</span>
              <input
                className="ui-input"
                value={draft.referenceIdsText}
                onChange={(event) => setDraft({ ...draft, referenceIdsText: event.target.value })}
                placeholder="brand-voice, onboarding-guide"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="ui-context-editor__section">
        <div className="ui-context-editor__fragments-header">
          <div>
            <h3>Reusable sections</h3>
            <p className="ui-text-secondary">Edit the type, title, content, order, and tags for each reusable section.</p>
          </div>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => setDraft({ ...draft, fragments: [...draft.fragments, createEmptyFragment(draft.fragments.length)] })}
          >
            Add section
          </button>
        </div>

        <div className="ui-context-editor__fragments">
          {sortedFragments.map((fragment, index) => (
            <ContextFragmentEditor
              key={`${fragment.id}-${index}`}
              fragment={fragment}
              onChange={(nextFragment) =>
                setDraft({
                  ...draft,
                  fragments: draft.fragments.map((candidate) =>
                    candidate.id === fragment.id ? nextFragment : candidate,
                  ),
                })
              }
              onDelete={
                sortedFragments.length > 1
                  ? () =>
                      setDraft({
                        ...draft,
                        fragments: draft.fragments.filter((candidate) => candidate.id !== fragment.id),
                      })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="ui-page__actions">
        {contextPackage?.id ? (
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--md"
            disabled={isSaving}
            onClick={() => onUpdate?.(contextPackage.id, payload)}
          >
            Save pack
          </button>
        ) : (
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--md"
            disabled={isSaving}
            onClick={() => onCreate?.(payload)}
          >
            Create pack
          </button>
        )}
      </div>
    </div>
  );
}
