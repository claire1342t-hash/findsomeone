import { useEffect } from "react";

/** Clears map-page body scroll lock and resets window scroll after route changes. */
export function useRestorePageScroll() {
  useEffect(() => {
    document.body.style.overflow = "";
    window.scrollTo(0, 0);
  }, []);
}
