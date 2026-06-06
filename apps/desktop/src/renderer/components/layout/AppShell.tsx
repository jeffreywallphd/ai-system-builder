import { useEffect, useRef, type ReactNode } from "react";

import type { DesktopPageDefinition, DesktopPageKey } from "../../routes/desktopPages";
import appLogoSrc from "../../../../../../modules/ui/shared/assets/branding/logo.svg";
import { WorkspaceSwitcher } from "../../features/workspace";

export interface AppShellProps {
  activePage?: DesktopPageKey;
  onNavigate: (nextPage: DesktopPageKey) => void;
  pages: readonly DesktopPageDefinition[];
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, pages, children }: AppShellProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const primaryPages = pages.filter((page) => page.key !== "settings");
  const navigationPages: readonly (DesktopPageDefinition | { readonly key: "home"; readonly label: "Home" })[] = [
    { key: "home", label: "Home" },
    ...primaryPages,
  ];

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const menu = menuRef.current;
      const target = event.target;

      if (!menu?.open || !target || !(target as Node).nodeType || menu.contains(target as Node)) {
        return;
      }

      menu.open = false;
    };

    document.addEventListener("mousedown", closeMenuOnOutsideClick);
    document.addEventListener("touchstart", closeMenuOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeMenuOnOutsideClick);
      document.removeEventListener("touchstart", closeMenuOnOutsideClick);
    };
  }, []);

  return (
    <main className="ui-shell">
      <header className="ui-shell__header">
        <div className="ui-container ui-shell__header-inner">
          <div className="ui-shell__header-left">
            <div className="ui-shell__brand">
              <button
                type="button"
                className="ui-shell__logo-button"
                aria-label="Go to Home"
                title="Home"
                onClick={() => onNavigate("home")}
              >
                <span className="ui-shell__logo-frame">
                  <img className="ui-shell__logo-image" src={appLogoSrc} alt="" aria-hidden="true" />
                </span>
              </button>
              <h1 className="ui-shell__title">AI System Builder</h1>
            </div>
          </div>
          <div className="ui-shell__header-center">
            <WorkspaceSwitcher variant="header" />
          </div>
          <div className="ui-shell__header-actions">
            <nav className="ui-shell__nav" aria-label="Primary">
              <details ref={menuRef} className="ui-shell__menu">
                <summary className="ui-shell__menu-trigger" aria-label="Open navigation menu" title="Menu">
                  <span className="ui-shell__hamburger" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="ui-visually-hidden">Menu</span>
                </summary>
                <div className="ui-shell__menu-panel" role="menu">
                  {navigationPages.map((page) => (
                    <button
                      key={page.key}
                      className="ui-shell__menu-item"
                      type="button"
                      role="menuitem"
                      aria-current={activePage === page.key ? "page" : undefined}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onNavigate(page.key);
                      }}
                    >
                      {page.label}
                    </button>
                  ))}
                </div>
              </details>
            </nav>
            <button
              className="ui-shell__settings-button"
              type="button"
              aria-current={activePage === "settings" ? "page" : undefined}
              aria-label="Settings"
              title="Settings"
              onClick={() => onNavigate("settings")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-shell__settings-icon">
                <path
                  className="ui-shell__settings-gear"
                  d="M9.54 3.25 8.83 5.4a7.88 7.88 0 0 0-1.33.77L5.3 5.7 3.1 9.5l1.5 1.68a7.55 7.55 0 0 0 0 1.64L3.1 14.5l2.2 3.8 2.2-.47c.42.3.86.55 1.33.77l.71 2.15h4.92l.71-2.15c.47-.22.91-.47 1.33-.77l2.2.47 2.2-3.8-1.5-1.68a7.55 7.55 0 0 0 0-1.64l1.5-1.68-2.2-3.8-2.2.47a7.88 7.88 0 0 0-1.33-.77l-.71-2.15H9.54Z"
                />
                <path className="ui-shell__settings-hub" d="M12 8.45 15.08 10.23v3.54L12 15.55l-3.08-1.78v-3.54L12 8.45Z" />
                <path className="ui-shell__settings-lines" d="M12 8.45V12m0 0 3.08-1.77M12 12l-3.08-1.77M12 12v3.55" />
              </svg>
              <span className="ui-visually-hidden">Settings</span>
            </button>
          </div>
        </div>
      </header>
      <div className="ui-container ui-shell__main">
        {children}
      </div>
    </main>
  );
}
