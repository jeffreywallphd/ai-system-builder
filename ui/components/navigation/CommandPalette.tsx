import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPaletteService, type CommandPaletteEntry } from "../../routes/CommandPalette";

export interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const service = useMemo(() => new CommandPaletteService(), []);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSearchText("");
    }
  }, [isOpen]);

  const model = useMemo(
    () => service.resolveModel({ pathname: location.pathname, search: location.search }, { searchText }),
    [location.pathname, location.search, searchText, service],
  );

  const onExecute = (entry: CommandPaletteEntry): void => {
    onClose();
    void navigate(entry.action.launchPath);
  };

  return (
    <div className={`ui-overlay-panel ui-overlay-panel--bottom${isOpen ? " ui-overlay-panel--open" : ""}`} aria-hidden={!isOpen}>
      <button type="button" className="ui-overlay-panel__scrim" onClick={onClose} aria-label="Close command palette" />
      <aside className="ui-overlay-panel__surface" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="ui-overlay-panel__header">
          <div className="ui-stack ui-stack--2xs">
            <strong>Command palette</strong>
            <span className="ui-text-small ui-text-secondary">Jump to Build, Explore, Run, and common intent actions.</span>
          </div>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onClose}>Close</button>
        </div>
        <div className="ui-overlay-panel__body ui-stack ui-stack--sm">
          <input
            autoFocus={isOpen}
            className="ui-input"
            placeholder={model.placeholder}
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            aria-label="Search commands"
          />

          <div className="ui-stack ui-stack--2xs">
            {model.entries.length > 0 ? model.entries.slice(0, 12).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="ui-button ui-button--ghost"
                style={{ justifyContent: "space-between" }}
                onClick={() => onExecute(entry)}
              >
                <span>{entry.label}</span>
                <span className="ui-text-small ui-text-secondary">{entry.category}</span>
              </button>
            )) : (
              <p className="ui-text-secondary" style={{ margin: 0 }}>
                No commands matched your search. Try “build”, “explore”, or “run”.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
