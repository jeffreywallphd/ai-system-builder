import type { ContextFragmentKind, IContextFragment } from "../../../application/context/models/ContextFragment";

export interface ContextFragmentEditorProps {
  readonly fragment: IContextFragment;
  readonly onChange: (fragment: IContextFragment) => void;
  readonly onDelete?: () => void;
}

const fragmentKinds: ReadonlyArray<ContextFragmentKind> = Object.freeze([
  "instructions",
  "persona",
  "domain-notes",
  "retrieved-context",
  "examples",
  "memory-snippets",
  "formatting-constraints",
]);

function friendlyFragmentKind(kind: ContextFragmentKind): string {
  switch (kind) {
    case "instructions":
      return "Instructions";
    case "persona":
      return "Voice and tone";
    case "domain-notes":
      return "Reference notes";
    case "retrieved-context":
      return "Retrieved info";
    case "examples":
      return "Examples";
    case "memory-snippets":
      return "Saved memories";
    case "formatting-constraints":
      return "Formatting rules";
    default:
      return kind;
  }
}

function metadataTagsToString(metadata?: Readonly<Record<string, unknown>>): string {
  const tags = Array.isArray(metadata?.tags)
    ? metadata?.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];

  return tags.join(", ");
}

function parseMetadataTags(value: string): Readonly<Record<string, unknown>> | undefined {
  const tags = [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
  return tags.length > 0 ? Object.freeze({ tags: Object.freeze(tags) }) : undefined;
}

export default function ContextFragmentEditor({
  fragment,
  onChange,
  onDelete,
}: ContextFragmentEditorProps): JSX.Element {
  return (
    <article className="ui-card ui-context-fragment-editor">
      <div className="ui-context-fragment-editor__toolbar">
        <h4 className="ui-context-fragment-editor__title">{fragment.title || fragment.id}</h4>
        {onDelete ? (
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onDelete}>
            Remove section
          </button>
        ) : null}
      </div>

      <div className="ui-context-grid">
        <label className="ui-field">
          <span className="ui-label">Section ID</span>
          <input
            className="ui-input"
            value={fragment.id}
            onChange={(event) => onChange({ ...fragment, id: event.target.value })}
          />
        </label>

        <label className="ui-field">
          <span className="ui-label">Kind</span>
          <select
            className="ui-input"
            value={fragment.kind}
            onChange={(event) => onChange({ ...fragment, kind: event.target.value as ContextFragmentKind })}
          >
            {fragmentKinds.map((kind) => (
              <option key={kind} value={kind}>
                {friendlyFragmentKind(kind)}
              </option>
            ))}
          </select>
        </label>

        <label className="ui-field">
          <span className="ui-label">Title</span>
          <input
            className="ui-input"
            value={fragment.title ?? ""}
            onChange={(event) => onChange({ ...fragment, title: event.target.value })}
          />
        </label>

        <label className="ui-field">
          <span className="ui-label">Order</span>
          <input
            className="ui-input"
            type="number"
            value={fragment.order}
            onChange={(event) => onChange({ ...fragment, order: Number(event.target.value) || 0 })}
          />
        </label>
      </div>

      <label className="ui-field">
        <span className="ui-label">Section tags</span>
        <input
          className="ui-input"
          value={metadataTagsToString(fragment.metadata)}
          onChange={(event) => onChange({ ...fragment, metadata: parseMetadataTags(event.target.value) })}
          placeholder="persona, approval, style"
        />
      </label>

      <label className="ui-field">
        <span className="ui-label">Content</span>
        <textarea
          className="ui-input ui-context-fragment-editor__content"
          rows={8}
          value={fragment.content}
          onChange={(event) => onChange({ ...fragment, content: event.target.value })}
        />
      </label>
    </article>
  );
}
