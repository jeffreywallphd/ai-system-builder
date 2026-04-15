import { useState } from "react";

import type { DesktopPageKey } from "../routes/desktopPage";

export function useDesktopPage(initialPage: DesktopPageKey = "home") {
  const [activePage, setActivePage] = useState<DesktopPageKey>(initialPage);

  return {
    activePage,
    setActivePage,
  };
}
