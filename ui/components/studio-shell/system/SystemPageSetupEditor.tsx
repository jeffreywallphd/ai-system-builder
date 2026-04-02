import type { SystemStudioPageDefinition } from "../../../studio-shell/system/SystemStudioDraftDocument";

interface SystemPageSetupEditorProps {
  readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: ReadonlyArray<SystemStudioPageDefinition>) => void;
}

function createPageId(existing: ReadonlyArray<SystemStudioPageDefinition>): string {
  const ids = new Set(existing.map((page) => page.pageId));
  let index = existing.length + 1;
  while (ids.has(`page-${index}`)) {
    index += 1;
  }
  return `page-${index}`;
}

export function SystemPageSetupEditor({
  pages,
  selectedPageId,
  onSelectPage,
  onPagesChange,
}: SystemPageSetupEditorProps): JSX.Element {
  const updatePage = (index: number, updates: Partial<SystemStudioPageDefinition>): void => {
    const nextPages = [...pages];
    const current = nextPages[index];
    if (!current) {
      return;
    }
    nextPages[index] = Object.freeze({
      ...current,
      ...updates,
    });
    onPagesChange(Object.freeze(nextPages));
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-page-setup-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>Set up your pages</strong>
        <p className="ui-text-small ui-text-secondary">
          Add the pages people will move through, then give each page a clear title and short description.
        </p>
      </div>

      <div className="ui-form-array">
        <div className="ui-form-array__header">
          <strong>Pages</strong>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={() => {
              const newPageId = createPageId(pages);
              const nextPages = Object.freeze([
                ...pages,
                Object.freeze({
                  pageId: newPageId,
                  title: `Page ${pages.length + 1}` ,
                  description: "",
                  layout: Object.freeze({
                    layoutKind: "workspace",
                    defaultRegionId: "workspace",
                    regionIds: Object.freeze(["workspace"]),
                  }),
                  navigation: Object.freeze({
                    route: `/${newPageId}` ,
                    title: `Page ${pages.length + 1}` ,
                    supportsDeepLinking: false,
                    requiresRuntimeSession: false,
                  }),
                }),
              ]);
              onPagesChange(nextPages);
              onSelectPage(newPageId);
            }}
          >
            Add page
          </button>
        </div>

        {pages.map((page, index) => (
          <div
            key={page.pageId}
            className="ui-form-array__row"
          >
            <div className="ui-row ui-row--between ui-row--wrap">
              <button
                type="button"
                className={`ui-button ui-button--sm ${selectedPageId === page.pageId ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => onSelectPage(page.pageId)}
              >
                {`Open ${page.title || `Page ${index + 1}`}`}
              </button>
              <div className="ui-row ui-row--wrap ui-row--end">
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  disabled={index === 0}
                  onClick={() => {
                    if (index === 0) {
                      return;
                    }
                    const nextPages = [...pages];
                    const [current] = nextPages.splice(index, 1);
                    nextPages.splice(index - 1, 0, current);
                    onPagesChange(Object.freeze(nextPages));
                  }}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  disabled={index === pages.length - 1}
                  onClick={() => {
                    if (index >= pages.length - 1) {
                      return;
                    }
                    const nextPages = [...pages];
                    const [current] = nextPages.splice(index, 1);
                    nextPages.splice(index + 1, 0, current);
                    onPagesChange(Object.freeze(nextPages));
                  }}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  disabled={pages.length <= 1}
                  onClick={() => {
                    if (pages.length <= 1) {
                      return;
                    }
                    const nextPages = Object.freeze(pages.filter((entry) => entry.pageId !== page.pageId));
                    onPagesChange(nextPages);
                    if (selectedPageId === page.pageId && nextPages[0]) {
                      onSelectPage(nextPages[0].pageId);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">Page title</span>
                <input
                  className="ui-input"
                  value={page.title}
                  placeholder="Example: Welcome"
                  onChange={(event) => updatePage(index, { title: event.target.value })}
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Description</span>
                <input
                  className="ui-input"
                  value={page.description ?? ""}
                  placeholder="One sentence about what this page helps with"
                  onChange={(event) => updatePage(index, { description: event.target.value })}
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Page link</span>
                <input
                  className="ui-input"
                  value={page.navigation?.route ?? ""}
                  placeholder="Example: /welcome"
                  onChange={(event) => updatePage(index, {
                    navigation: Object.freeze({
                      route: event.target.value,
                      title: page.navigation?.title ?? page.title,
                      supportsDeepLinking: page.navigation?.supportsDeepLinking ?? false,
                      navGroup: page.navigation?.navGroup,
                      requiresRuntimeSession: page.navigation?.requiresRuntimeSession ?? false,
                    }),
                  })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SystemPageSetupEditor;
