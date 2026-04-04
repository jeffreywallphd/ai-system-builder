import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { validateRegisterForm } from "../shared/identity/IdentityAuthValidation";

export default function RegisterPage(): JSX.Element {
  const authService = useMemo(() => new IdentityAuthService(), []);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    const validation = validateRegisterForm({ username, email, password, confirmPassword });
    if (validation.length > 0) {
      setErrorMessage(validation.map((issue) => issue.message).join(" "));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.registerLocalAccount({
        username: username.trim(),
        email: email.trim() || undefined,
        displayName: displayName.trim() || undefined,
        credential: { candidate: password },
      });

      if (!response.ok || !response.data) {
        setErrorMessage(renderApiError(response.error?.message, response.error?.validationErrors));
        return;
      }

      setSuccessMessage(`Account created for ${response.data.providerSubject}. You can now sign in.`);
      navigate(ROUTE_PATHS.login, {
        state: {
          providerSubject: response.data.providerSubject,
          registrationSuccess: true,
        },
      });
    } catch {
      setErrorMessage("Registration request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="ui-page ui-auth-page">
      <div className="ui-auth-card ui-card">
        <div className="ui-card__header">
          <h1 className="ui-card__title">Create a local AI Loom account</h1>
          <p className="ui-card__subtitle">
            Register with the local identity provider.
          </p>
        </div>

        <form className="ui-card__body ui-form-grid ui-form-grid--single" onSubmit={submitRegistration}>
          <label className="ui-field">
            <span className="ui-field__label">Username</span>
            <input
              className="ui-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Email (optional)</span>
            <input
              className="ui-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Display name (optional)</span>
            <input
              className="ui-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Password</span>
            <input
              className="ui-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Confirm password</span>
            <input
              className="ui-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <p className="ui-auth-page__error" role="alert">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="ui-auth-page__success" role="status">{successMessage}</p>
          ) : null}

          <div className="ui-page__actions">
            <button className="ui-button ui-button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
            <Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.login}>
              Back to sign in
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
    return message || "Registration failed.";
  }
  const details = validationErrors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
  return `${message || "Registration failed."} ${details}`;
}
