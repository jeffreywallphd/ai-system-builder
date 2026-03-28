import { Link } from "react-router-dom";
import type { FavoriteItem, RecentItem, RecentAndFavoritesService } from "../../routes/RecentAndFavorites";

export interface RecentAndFavoritesPanelProps {
  readonly service: RecentAndFavoritesService;
  readonly recents: ReadonlyArray<RecentItem>;
  readonly favorites: ReadonlyArray<FavoriteItem>;
}

export default function RecentAndFavoritesPanel({ service, recents, favorites }: RecentAndFavoritesPanelProps): JSX.Element {
  return (
    <section className="ui-card" data-testid="recent-favorites-panel">
      <div className="ui-card__body ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <div className="ui-stack ui-stack--xs">
          <h3 style={{ margin: 0 }}>Recent</h3>
          {recents.length > 0 ? recents.map((entry) => (
            <Link key={entry.id} className="ui-button ui-button--ghost ui-button--small" to={service.resolveReopenAction(entry)}>
              {entry.title}
            </Link>
          )) : <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>No recent items yet.</p>}
        </div>

        <div className="ui-stack ui-stack--xs">
          <h3 style={{ margin: 0 }}>Favorites</h3>
          {favorites.length > 0 ? favorites.map((entry) => (
            <Link key={entry.id} className="ui-button ui-button--ghost ui-button--small" to={service.resolveReopenAction(entry)}>
              {entry.title}
            </Link>
          )) : <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>No favorites yet.</p>}
        </div>
      </div>
    </section>
  );
}
