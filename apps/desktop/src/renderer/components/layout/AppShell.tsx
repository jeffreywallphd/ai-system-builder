import { useEffect, useRef, type ReactNode } from "react";

import type { DesktopPageDefinition, DesktopPageKey } from "../../routes/desktopPages";
import appLogoSrc from "../../../../../../modules/ui/shared/assets/branding/logo.svg";

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
          <nav className="ui-shell__nav" aria-label="Primary">
            <details ref={menuRef} className="ui-shell__menu">
              <summary className="ui-button ui-button--icon ui-shell__menu-trigger" aria-label="Open navigation menu" title="Menu">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-icon">
                  <path d="M4 6.5h16v2H4v-2Zm0 4.5h16v2H4v-2Zm0 4.5h16v2H4v-2Z" />
                </svg>
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
            <button
              className="ui-button ui-button--icon"
              type="button"
              aria-current={activePage === "settings" ? "page" : undefined}
              aria-label="Settings"
              title="Settings"
              onClick={() => onNavigate("settings")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-icon">
                <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
                <path d="M19.25 12c0-.37-.03-.73-.08-1.09l2.03-1.58-1.92-3.32-2.39.96a7.32 7.32 0 0 0-1.89-1.09L14.64 3h-3.84l-.36 2.88c-.68.27-1.31.64-1.88 1.09l-2.4-.96-1.92 3.32 2.04 1.58a7.6 7.6 0 0 0 0 2.18l-2.04 1.58 1.92 3.32 2.4-.96c.57.45 1.2.82 1.88 1.09l.36 2.88h3.84l.36-2.88c.68-.27 1.32-.64 1.89-1.09l2.39.96 1.92-3.32-2.03-1.58c.05-.36.08-.72.08-1.09Z" />
              </svg>
              <span className="ui-visually-hidden">Settings</span>
            </button>
          </nav>
        </div>
      </header>
      <div className="ui-container ui-shell__main">
        {children}
      </div>
    </main>
  );
}
