import { useCallback, useEffect } from "react";

export function useVisualViewportHeight(cssVarName = "--app-vh") {
  const update = useCallback(() => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty(cssVarName, `${height * 0.01}px`);
  }, [cssVarName]);

  useEffect(() => {
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty(cssVarName);
    };
  }, [cssVarName, update]);

  return update;
}
