import { useEffect } from "react";

/** Clears map-page body scroll lock and resets window scroll after route changes. */
export function useRestorePageScroll() {
  useEffect(() => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.top = "";
    window.scrollTo(0, 0);
  }, []);
}
