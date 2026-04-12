import type { ReactNode } from "react";

export interface AdminSettingsSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly scopeLabel?: string;
  readonly permissionLabel?: string;
  readonly mode: "editable" | "read-only";
  readonly children: ReactNode;
}

export function AdminSettingsSection({
  title,
  description,
  scopeLabel,
  permissionLabel,
  mode,
  children,
}: AdminSettingsSectionProps): JSX.Element {
  return (
    <section className="ui-card ui-admin-settings-section">
      <div className="ui-card__header">
        <h2 className="ui-card__title">{title}</h2>
        {description ? <p className="ui-card__subtitle">{description}</p> : null}
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-admin-settings-section__badges">
          <span className={`ui-admin-settings-badge ui-admin-settings-badge--${mode}`}>
            {mode === "editable" ? "Editable" : "Inspect only"}
          </span>
          {scopeLabel ? <span className="ui-admin-settings-badge">Scope: {scopeLabel}</span> : null}
          {permissionLabel ? <span className="ui-admin-settings-badge">Permission: {permissionLabel}</span> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export interface AdminSettingsFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function AdminSettingsField({ label, hint, children }: AdminSettingsFieldProps): JSX.Element {
  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export interface AdminReadonlyPropertyProps {
  readonly label: string;
  readonly value: ReactNode;
}

export function AdminReadonlyProperty({ label, value }: AdminReadonlyPropertyProps): JSX.Element {
  return (
    <div className="ui-admin-settings-property">
      <span className="ui-admin-settings-property__label">{label}</span>
      <span className="ui-admin-settings-property__value">{value}</span>
    </div>
  );
}
