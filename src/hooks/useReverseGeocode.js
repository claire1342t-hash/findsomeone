import { useEffect, useMemo, useState } from "react";
import { reverseGeocode } from "../utils/reverseGeocode.js";

function coordKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

/**
 * Resolve Nominatim reverse addresses for posts with lat/lng (deduped by coordinate).
 * @param {Array<{ id?: string, location?: { lat?: number, lng?: number } }>} posts
 * @param {string} language
 * @returns {(post: { location?: { lat?: number, lng?: number } }) => string | null | undefined}
 *   undefined = still loading, null = no result, string = address
 */
export function useReverseGeocode(posts, language) {
  const [byCoord, setByCoord] = useState({});

  const signature = useMemo(
    () =>
      posts
        .map((p) => {
          const lat = p.location?.lat;
          const lng = p.location?.lng;
          return `${p.id ?? ""}:${lat},${lng}`;
        })
        .join("|"),
    [posts],
  );

  useEffect(() => {
    const unique = new Map();
    for (const post of posts) {
      const lat = post.location?.lat;
      const lng = post.location?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = coordKey(lat, lng);
      if (!unique.has(key)) unique.set(key, { lat, lng });
    }

    if (unique.size === 0) {
      setByCoord({});
      return undefined;
    }

    let cancelled = false;
    setByCoord((prev) => {
      const next = { ...prev };
      for (const key of unique.keys()) {
        if (!(key in next)) next[key] = undefined;
      }
      return next;
    });

    (async () => {
      for (const [key, { lat, lng }] of unique) {
        if (cancelled) return;
        const address = await reverseGeocode(lat, lng, language);
        if (cancelled) return;
        setByCoord((prev) => ({ ...prev, [key]: address }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, language]);

  return useMemo(() => {
    return (post) => {
      const lat = post.location?.lat;
      const lng = post.location?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const key = coordKey(lat, lng);
      if (!(key in byCoord)) return undefined;
      return byCoord[key] ?? null;
    };
  }, [byCoord]);
}
