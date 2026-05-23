/**
 * @param {{ locationDescription?: string }} post
 * @param {(post: unknown) => string | null | undefined} getReverseAddress
 * @param {(key: string) => string} t
 */
export function formatMapLocationLabel(post, getReverseAddress, t) {
  const desc = String(post.locationDescription ?? "").trim();
  const geo = getReverseAddress(post);

  if (desc && geo) return `${desc} · ${geo}`;
  if (desc) return desc;
  if (geo) return geo;
  if (geo === undefined && Number.isFinite(post.location?.lat) && Number.isFinite(post.location?.lng)) {
    return desc || t("map.locationGeocodeLoading");
  }
  return desc || t("map.locationFallback");
}
