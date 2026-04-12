import { Navigate, Outlet, useLocation } from "react-router-dom";

export interface ProtectedRouteProps {
  readonly isAllowed: boolean;
  readonly redirectTo?: string;
  readonly children?: JSX.Element;
}

export default function ProtectedRoute({
  isAllowed,
  redirectTo = "/",
  children,
}: ProtectedRouteProps): JSX.Element {
  const location = useLocation();

  if (!isAllowed) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children ?? <Outlet />;
}
