import AppRouter from "./routes/AppRouter";

export interface AppProps {
  readonly isAuthenticated?: boolean;
}

export default function App({
  isAuthenticated = true,
}: AppProps): JSX.Element {
  return <AppRouter isAuthenticated={isAuthenticated} />;
}
