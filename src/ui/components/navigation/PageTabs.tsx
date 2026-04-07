export interface PageTabItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly isHidden?: boolean;
}

export interface PageTabsProps {
  readonly label: string;
  readonly tabs: ReadonlyArray<PageTabItem>;
  readonly activeTabId: string;
  readonly onChange: (tabId: string) => void;
}

export default function PageTabs({
  label,
  tabs,
  activeTabId,
  onChange,
}: PageTabsProps): JSX.Element {
  const visibleTabs = tabs.filter((tab) => !tab.isHidden);

  return (
    <div className="ui-page-tabs">
      <div className="ui-page-tabs__list" role="tablist" aria-label={label}>
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              id={`page-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`page-tabpanel-${tab.id}`}
              className={`ui-page-tabs__tab${isActive ? " ui-page-tabs__tab--active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.description ? (
                <span className="ui-page-tabs__tab-copy">{tab.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
