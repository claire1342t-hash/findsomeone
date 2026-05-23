const CACHE = new Map();
const PENDING = new Map();

/** Nominatim fair-use: ~1 request / second. */
let throttleChain = Promise.resolve();
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

function coordCacheKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function localeForLanguage(language) {
  if (language === "ja") return "ja";
  if (language === "en") return "en";
  return "zh-TW";
}

/**
 * Shorter readable label from Nominatim reverse jsonv2 (Taiwan-friendly when possible).
 * @param {Record<string, unknown>} data
 */
export function formatReverseAddress(data) {
  const addr = data?.address;
  if (addr && typeof addr === "object") {
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state;
    const district =
      addr.suburb || addr.city_district || addr.district || addr.borough || addr.quarter;
    const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood;
    const parts = [city, district, road].filter((p) => typeof p === "string" && p.trim());
    if (parts.length) return parts.join("");
  }
  const display = String(data?.display_name ?? "").trim();
  if (!display) return null;
  return display.split(",").slice(0, 3).join(",").trim();
}

function scheduleThrottled(task) {
  throttleChain = throttleChain.then(async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });
  return throttleChain;
}

async function fetchReverse(lat, lng, language) {
  const locale = localeForLanguage(language);
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    addressdetails: "1",
    "accept-language": locale,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Findsomeone/1.0 (https://www.findsomeone.co)",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.error) return null;
  return formatReverseAddress(data);
}

/**
 * Reverse geocode via OpenStreetMap Nominatim (cached, throttled).
 * @param {number} lat
 * @param {number} lng
 * @param {string} [language] zh | en | ja
 * @returns {Promise<string | null>}
 */
export async function reverseGeocode(lat, lng, language = "zh") {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = coordCacheKey(lat, lng);
  if (CACHE.has(key)) return CACHE.get(key);
  if (PENDING.has(key)) return PENDING.get(key);

  const promise = scheduleThrottled(() => fetchReverse(lat, lng, language))
    .then((address) => {
      CACHE.set(key, address);
      return address;
    })
    .catch(() => {
      CACHE.set(key, null);
      return null;
    })
    .finally(() => {
      PENDING.delete(key);
    });

  PENDING.set(key, promise);
  return promise;
}
