import { useMemo } from "react";
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

  const model = useMemo(
    () => service.resolveDefaultModel({ pathname: location.pathname, search: location.search }),
    [location.pathname, location.search, service],
  );

  const onExecute = (entry: CommandPaletteEntry): void => {
    onClose();
    void navigate(entry.action.launchPath);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ui-overlay-panel ui-overlay-panel--right ui-overlay-panel--open ui-command-palette" aria-hidden={false}>
      <button type="button" className="ui-overlay-panel__scrim" onClick={onClose} aria-label="Close navigation menu" />
      <aside
        id="global-navigation-menu"
        className="ui-overlay-panel__surface"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="ui-overlay-panel__body ui-stack ui-stack--sm">
          <div className="ui-command-palette__entries">
            {model.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="ui-button ui-button--secondary ui-button--md ui-command-palette__entry"
                onClick={() => onExecute(entry)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
