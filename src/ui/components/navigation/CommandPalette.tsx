import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPaletteService, type CommandPaletteEntry } from "../../routes/CommandPalette";
import { useSurfaceDialogFocusTrap } from "../../shared/accessibility";
import { IdentityAuthSessionStore } from "../../shared/identity/IdentityAuthSessionStore";
import { UiSurfaceKeys } from "../../shared/navigation/SurfaceNavigationMetadata";
import { resolveNavigationAvailabilityContextForSession } from "../../routes/SurfaceRouteAccessPolicy";

export interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const service = useMemo(() => new CommandPaletteService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const dialogRef = useRef<HTMLElement>(null);
  const availabilityContext = useMemo(
    () => resolveNavigationAvailabilityContextForSession(session, {
      preferredSurface: session?.sessionAccessChannel === "desktop"
        ? UiSurfaceKeys.desktopAdmin
        : UiSurfaceKeys.adminLite,
      fallbackSurface: UiSurfaceKeys.desktopOperational,
      strict: true,
    }),
    [session],
  );

  useSurfaceDialogFocusTrap({
    isOpen,
    containerRef: dialogRef,
    onRequestClose: onClose,
  });

  const model = useMemo(
    () => service.resolveDefaultModel(
      { pathname: location.pathname, search: location.search },
      availabilityContext,
    ),
    [availabilityContext, location.pathname, location.search, service],
  );

  const onExecute = (entry: CommandPaletteEntry): void => {
    onClose();
    void navigate(entry.action.launchPath);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!container.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ui-overlay-panel ui-overlay-panel--right ui-overlay-panel--open ui-command-palette ui-command-palette--nonblocking" aria-hidden={false}>
      <aside
        ref={dialogRef}
        id="global-navigation-menu"
        className="ui-overlay-panel__surface"
        role="dialog"
        aria-modal={false}
        aria-label="Navigation menu"
        tabIndex={-1}
      >
        <div className="ui-overlay-panel__body ui-stack ui-stack--sm">
          <h2 className="ui-visually-hidden">Navigation menu actions</h2>
          <nav className="ui-command-palette__entries" aria-label="Available navigation destinations">
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
          </nav>
        </div>
      </aside>
    </div>
  );
}
