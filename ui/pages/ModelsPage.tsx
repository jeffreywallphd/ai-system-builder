export default function ModelsPage(): JSX.Element {
  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Models</h1>
          <p className="ui-page__subtitle">
            Search remote models and manage installed models.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body">
          <p className="ui-text-secondary">
            This page will host remote model search, install actions, and installed model management.
          </p>
        </div>
      </div>
    </section>
  );
}
