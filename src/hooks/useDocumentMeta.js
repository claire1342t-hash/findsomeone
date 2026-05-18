import { useEffect } from "react";

const SITE_ORIGIN = "https://www.findsomeone.co";

/**
 * Sets document title, meta description, and canonical URL for public pages.
 * @param {{ title?: string; description?: string; path?: string }} opts path e.g. "/about"
 */
export function useDocumentMeta({ title, description, path = "/" }) {
  useEffect(() => {
    const prevTitle = document.title;
    const canonicalHref = `${SITE_ORIGIN}${path === "/" ? "/" : path}`;

    if (title) {
      document.title = title;
    }

    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") ?? "";
    if (description && metaDesc) {
      metaDesc.setAttribute("content", description);
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    const prevCanonical = canonical.getAttribute("href") ?? "";
    canonical.setAttribute("href", canonicalHref);

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) {
        metaDesc.setAttribute("content", prevDesc);
      }
      if (canonical && prevCanonical) {
        canonical.setAttribute("href", prevCanonical);
      }
    };
  }, [title, description, path]);
}
