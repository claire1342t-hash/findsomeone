/**
 * First line of post appearance text, or i18n fallback.
 * @param {{ appearance?: string } | null | undefined} description
 * @param {(key: string) => string} t
 * @param {string} [fallbackKey]
 */
export function appearanceTitleFromDescription(description, t, fallbackKey = "map.postFallbackAppearance") {
  const appearance = description?.appearance ?? "";
  const firstLine = appearance.split(/\r?\n/)[0].trim();
  return firstLine || t(fallbackKey);
}

/**
 * @param {object | null | undefined} post
 * @param {(key: string) => string} t
 * @param {string} missingKey
 */
export function appearanceTitleFromPost(post, t, missingKey) {
  if (!post) return t(missingKey);
  return appearanceTitleFromDescription(post.description, t);
}
