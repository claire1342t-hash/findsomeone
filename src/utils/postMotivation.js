import { normalizeText } from "./textValidation.js";

const KNOWN_MOTIVATIONS = new Set(["know", "thanks", "noticed", "custom"]);

/**
 * Safe motivation label for display (unknown / missing fields fall back).
 * @param {object | null | undefined} post
 * @param {(key: string) => string} t
 */
export function getMotivationLabel(post, t) {
  const motivation = String(post?.motivation ?? "").trim();
  if (motivation === "custom") {
    const custom = normalizeText(post?.motivationCustom);
    return custom || t("post.motivation.custom");
  }
  if (KNOWN_MOTIVATIONS.has(motivation)) {
    return t(`post.motivation.${motivation}`);
  }
  return t("post.motivation.know");
}
