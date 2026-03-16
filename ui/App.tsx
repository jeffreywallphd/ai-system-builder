import AppRouter from "./routes/AppRouter";
import { AppProviders } from "./composition/AppProviders";
import { AppRuntimeConfig } from "../infrastructure/config/AppRuntimeConfig";

export interface AppProps {
  readonly isAuthenticated?: boolean;
  readonly config?: AppRuntimeConfig;
}

export default function App({
  isAuthenticated = true,
  config,
}: AppProps): JSX.Element {
  return (
    <AppProviders config={config}>
      <AppRouter isAuthenticated={isAuthenticated} />
    </AppProviders>
  );
}
