const AVATAR_COUNT = 12;

function avatarUrl(id) {
  return new URL(`./illustrations/profile_picture/${id}.webp`, import.meta.url).href;
}

/** @type {{ id: number, src: string }[]} */
export const AVATAR_OPTIONS = Array.from({ length: AVATAR_COUNT }, (_, i) => ({
  id: i + 1,
  src: avatarUrl(i + 1),
}));

export function getAvatarById(id) {
  const normalized = Number(id);
  const safe = normalized >= 1 && normalized <= AVATAR_COUNT ? normalized : 1;
  return avatarUrl(safe);
}
