import "./PageStyles.css";

export default function ModelsPage(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <h1 className="page-title">Models</h1>
          <p className="page-subtitle">
            Search remote models and manage installed models.
          </p>
        </div>
      </div>

      <div className="page-card">
        <p>
          This page will host remote model search, install actions, and installed
          model management.
        </p>
      </div>
    </section>
  );
}
