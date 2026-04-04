import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LoginLocalIdentityApiResponse } from "../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { validateLoginForm } from "../shared/identity/IdentityAuthValidation";

export interface LoginPageProps {
  readonly onAuthenticated: (session: LoginLocalIdentityApiResponse) => void;
}

export default function LoginPage({ onAuthenticated }: LoginPageProps): JSX.Element {
  const authService = useMemo(() => new IdentityAuthService(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as {
    from?: string;
    providerSubject?: string;
    registrationSuccess?: boolean;
  } | undefined;
  const fromPath = routeState?.from || ROUTE_PATHS.home;

  const [providerSubject, setProviderSubject] = useState(routeState?.providerSubject || "");
  const [password, setPassword] = useState("");
  const [providerId, setProviderId] = useState("provider:local-password");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(undefined);

    const validation = validateLoginForm({ providerSubject, password });
    if (validation.length > 0) {
      setErrorMessage(validation.map((issue) => issue.message).join(" "));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.loginLocalAccount({
        providerId: providerId.trim() || undefined,
        providerSubject: providerSubject.trim(),
        credential: { candidate: password },
      });

      if (!response.ok || !response.data) {
        setErrorMessage(renderApiError(response.error?.message, response.error?.validationErrors));
        return;
      }

      onAuthenticated(response.data);
      navigate(fromPath, { replace: true });
    } catch {
      setErrorMessage("Login request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="ui-page ui-auth-page">
      <div className="ui-auth-card ui-card">
        <div className="ui-card__header">
          <h1 className="ui-card__title">Sign in to AI Loom Studio</h1>
          <p className="ui-card__subtitle">
            Use your local AI Loom account credentials.
          </p>
        </div>

        <form className="ui-card__body ui-form-grid ui-form-grid--single" onSubmit={submitLogin}>
          <label className="ui-field">
            <span className="ui-field__label">Username</span>
            <input
              className="ui-input"
              autoComplete="username"
              value={providerSubject}
              onChange={(event) => setProviderSubject(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Password</span>
            <input
              className="ui-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Provider id</span>
            <input
              className="ui-input"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
            />
            <span className="ui-field__hint">Keep the default for local password accounts.</span>
          </label>

          {errorMessage ? (
            <p className="ui-auth-page__error" role="alert">{errorMessage}</p>
          ) : null}
          {routeState?.registrationSuccess ? (
            <p className="ui-auth-page__success" role="status">Account registration succeeded. Sign in to continue.</p>
          ) : null}

          <div className="ui-page__actions">
            <button className="ui-button ui-button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
            <Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.register}>
              Create account
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}

function renderApiError(
  message?: string,
  validationErrors?: ReadonlyArray<{ path: string; message: string }>,
): string {
  if (!validationErrors || validationErrors.length === 0) {
    return message || "Login failed.";
  }
  const details = validationErrors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
  return `${message || "Login failed."} ${details}`;
}
