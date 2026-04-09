import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type {
  IdentityAuthApiError,
  LoginLocalIdentityApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { resolveIdentityAccessChannel, resolveIdentityClientContext } from "@shared/identity/IdentityAuthEnvironment";
import { validateLoginForm } from "@shared/identity/IdentityAuthValidation";
import { guardAuthenticationInitialization } from "../shared/identity/AuthenticationInitializationGuard";

export interface LoginPageProps {
  readonly onAuthenticated: (session: LoginLocalIdentityApiResponse) => boolean | Promise<boolean>;
  readonly authNotice?: "session-expired" | "session-invalid" | "session-context-unavailable" | "session-bootstrap-timeout";
  readonly devLoginEnabled?: boolean;
}

export default function LoginPage({ onAuthenticated, authNotice, devLoginEnabled = false }: LoginPageProps): JSX.Element {
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
        accessChannel: resolveIdentityAccessChannel(),
        client: resolveIdentityClientContext(),
        credential: { candidate: password },
      });

      if (!response.ok || !response.data) {
        setErrorMessage(renderApiError(response.error));
        return;
      }

      const initialization = await guardAuthenticationInitialization(onAuthenticated, response.data);
      if (!initialization.initialized) {
        setErrorMessage(initialization.timedOut
          ? "Sign-in finished but session initialization took too long. Please try again."
          : "Sign-in finished but session setup could not be completed. Please try again.");
        return;
      }
      navigate(fromPath, { replace: true });
    } catch {
      setErrorMessage("Login request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDevLogin = async () => {
    setErrorMessage(undefined);
    setIsSubmitting(true);
    try {
      const response = await authService.loginDevelopmentAccount({
        accessChannel: resolveIdentityAccessChannel(),
        client: resolveIdentityClientContext(),
      });
      if (!response.ok || !response.data) {
        setErrorMessage(renderApiError(response.error));
        return;
      }

      const initialization = await guardAuthenticationInitialization(onAuthenticated, response.data);
      if (!initialization.initialized) {
        setErrorMessage(initialization.timedOut
          ? "Dev sign-in finished but session initialization took too long. Please try again."
          : "Dev sign-in finished but session setup could not be completed. Please try again.");
        return;
      }
      navigate(fromPath, { replace: true });
    } catch {
      setErrorMessage("Dev login request failed. Verify the identity API is reachable and try again.");
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
          {authNotice === "session-expired" ? (
            <p className="ui-auth-page__error" role="status">Your session expired. Sign in again to continue.</p>
          ) : null}
          {authNotice === "session-invalid" ? (
            <p className="ui-auth-page__error" role="status">Your session was revoked or is no longer valid. Sign in again.</p>
          ) : null}
          {authNotice === "session-context-unavailable" ? (
            <p className="ui-auth-page__error" role="status">Session context could not be initialized from the server. Verify API connectivity and sign in again.</p>
          ) : null}
          {authNotice === "session-bootstrap-timeout" ? (
            <p className="ui-auth-page__error" role="status">Saved sign-in verification took too long. Sign in again to continue.</p>
          ) : null}

          <div className="ui-page__actions">
            <button className="ui-button ui-button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
            <Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.register}>
              Create account
            </Link>
            {devLoginEnabled ? (
              <button className="ui-button ui-button--secondary" type="button" onClick={submitDevLogin} disabled={isSubmitting}>
                Dev Login
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function renderApiError(error: IdentityAuthApiError | undefined): string {
  const trustFailureReason = error?.trustFailure?.reason;
  if (trustFailureReason === "registration-missing" || trustFailureReason === "pinned-trust-material-missing") {
    return "Trusted device verification is required. Pair this desktop with your account before signing in.";
  }
  if (
    trustFailureReason === "pinned-trust-material-expired"
    || trustFailureReason === "session-assurance-not-trusted"
  ) {
    return "Trusted device trust material has expired. Re-pair this desktop client and sign in again.";
  }

  const validationErrors = error?.validationErrors;
  if (!validationErrors || validationErrors.length === 0) {
    return error?.message || "Login failed.";
  }
  const details = validationErrors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
  return `${error?.message || "Login failed."} ${details}`;
}
