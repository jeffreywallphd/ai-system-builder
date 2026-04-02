import { useMemo, useState } from "react";
import type { SystemStudioPageDefinition } from "../../../studio-shell/system/SystemStudioDraftDocument";
import {
  createSystemStudioPageModel,
  systemPageLayoutTemplates,
  type SystemPageLayoutTemplate,
} from "../../../studio-shell/system/SystemPageModel";

interface SystemPageSetupEditorProps {
  readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: ReadonlyArray<SystemStudioPageDefinition>) => void;
}

export function SystemPageSetupEditor({
  pages,
  selectedPageId,
  onSelectPage,
  onPagesChange,
}: SystemPageSetupEditorProps): JSX.Element {
  const [newPageTitle, setNewPageTitle] = useState<string>("");
  const [newPageDescription, setNewPageDescription] = useState<string>("");
  const [newPageLayoutKind, setNewPageLayoutKind] = useState<SystemPageLayoutTemplate["layoutKind"]>("workspace");

  const selectedPage = useMemo(
    () => pages.find((page) => page.pageId === selectedPageId) ?? pages[0],
    [pages, selectedPageId],
  );

  const createPage = (): void => {
    const newPage = createSystemStudioPageModel({
      existingPages: pages,
      title: newPageTitle,
      description: newPageDescription,
      layoutKind: newPageLayoutKind,
    });
    const nextPages = Object.freeze([...pages, newPage]);
    onPagesChange(nextPages);
    onSelectPage(newPage.pageId);
    setNewPageTitle("");
    setNewPageDescription("");
    setNewPageLayoutKind("workspace");
  };

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
        <strong>Set up your screens</strong>
        <p className="ui-text-small ui-text-secondary">
          Add the screens people move through, choose a layout style, and keep names simple for your team.
        </p>
      </div>

      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="system-page-create-flow">
        <div className="ui-stack ui-stack--3xs">
          <strong>Add a screen</strong>
          <p className="ui-text-small ui-text-secondary">
            Create a new screen now. You can arrange its major sections in Interface Design next.
          </p>
        </div>
        <div className="ui-form-grid">
          <label className="ui-field">
            <span className="ui-field__label">Screen title</span>
            <input
              className="ui-input"
              value={newPageTitle}
              placeholder="Example: Welcome"
              onChange={(event) => setNewPageTitle(event.target.value)}
            />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">What this screen helps with</span>
            <input
              className="ui-input"
              value={newPageDescription}
              placeholder="Example: Helps people start a new run"
              onChange={(event) => setNewPageDescription(event.target.value)}
            />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Layout style</span>
            <select
              className="ui-input"
              value={newPageLayoutKind}
              onChange={(event) => setNewPageLayoutKind(event.target.value as SystemPageLayoutTemplate["layoutKind"])}
            >
              {systemPageLayoutTemplates.map((template) => (
                <option key={template.layoutKind} value={template.layoutKind}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ui-row ui-row--between ui-row--wrap">
          <span className="ui-text-small ui-text-secondary">
            {systemPageLayoutTemplates.find((template) => template.layoutKind === newPageLayoutKind)?.summary}
          </span>
          <button type="button" className="ui-button ui-button--sm ui-button--primary" onClick={createPage}>
            Create screen
          </button>
        </div>
      </section>

      <div className="ui-form-array">
        <div className="ui-form-array__header">
          <strong>Screen list</strong>
        </div>

        {pages.length === 0 ? (
          <div className="ui-form-array__row" data-testid="system-page-list-empty-state">
            <strong>No screens yet</strong>
            <p className="ui-text-small ui-text-secondary">
              Create your first screen above to start shaping the experience.
            </p>
          </div>
        ) : null}

        {pages.map((page, index) => (
          <div
            key={page.pageId}
            className="ui-form-array__row"
          >
            <div className="ui-row ui-row--between ui-row--wrap">
              <div className="ui-stack ui-stack--3xs">
                <button
                  type="button"
                  className={`ui-button ui-button--sm ${selectedPageId === page.pageId ? "ui-button--primary" : "ui-button--ghost"}`}
                  onClick={() => onSelectPage(page.pageId)}
                >
                  {`${page.title || `Page ${index + 1}`}`}
                </button>
                <span className="ui-text-small ui-text-secondary">
                  {systemPageLayoutTemplates.find((template) => template.layoutKind === page.layout.layoutKind)?.title
                    ?? page.layout.layoutKind}
                </span>
              </div>
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
                <span className="ui-field__label">Screen title</span>
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
                  placeholder="One sentence about what this screen helps with"
                  onChange={(event) => updatePage(index, { description: event.target.value })}
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Layout style</span>
                <select
                  className="ui-input"
                  value={page.layout.layoutKind}
                  onChange={(event) => {
                    const selectedTemplate = systemPageLayoutTemplates.find((template) => template.layoutKind === event.target.value)
                      ?? systemPageLayoutTemplates[0];
                    updatePage(index, {
                      layout: Object.freeze({
                        layoutKind: selectedTemplate.layoutKind,
                        defaultRegionId: selectedTemplate.defaultRegionId,
                        regionIds: selectedTemplate.regionIds,
                      }),
                    });
                  }}
                >
                  {systemPageLayoutTemplates.map((template) => (
                    <option key={template.layoutKind} value={template.layoutKind}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Screen link</span>
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

      {selectedPage ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="system-page-selected-summary">
          <strong>{selectedPage.title}</strong>
          <p className="ui-text-small ui-text-secondary">
            Layout regions: {selectedPage.layout.regionIds.join(", ")}
          </p>
          <p className="ui-text-small ui-text-secondary">
            Link: {selectedPage.navigation?.route ?? `/${selectedPage.pageId}`}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default SystemPageSetupEditor;
