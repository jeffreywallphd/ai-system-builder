import { useState } from "react";

import type { DesktopPageKey } from "../components/layout/AppShell";

export function useDesktopPage(initialPage: DesktopPageKey = "home") {
  const [activePage, setActivePage] = useState<DesktopPageKey>(initialPage);

  return {
    activePage,
    setActivePage,
  };
}
