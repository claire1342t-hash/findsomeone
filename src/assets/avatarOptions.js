const AVATAR_COUNT = 12;

const avatarModules = import.meta.glob("./illustrations/profile_picture/*.webp", {
  eager: true,
  import: "default",
});

function avatarSources(id) {
  const base = `./illustrations/profile_picture/${id}.webp`;
  const small = `./illustrations/profile_picture/${id}-96w.webp`;
  const src = avatarModules[base];
  const smallSrc = avatarModules[small];
  return {
    src,
    srcSet: smallSrc ? `${smallSrc} 96w, ${src} 192w` : src,
  };
}

/** @type {{ id: number, src: string, srcSet: string }[]} */
export const AVATAR_OPTIONS = Array.from({ length: AVATAR_COUNT }, (_, i) => {
  const id = i + 1;
  const { src, srcSet } = avatarSources(id);
  return { id, src, srcSet };
});

/** @param {number | string} id @returns {{ src: string, srcSet: string }} */
export function getAvatarById(id) {
  const normalized = Number(id);
  const safe = normalized >= 1 && normalized <= AVATAR_COUNT ? normalized : 1;
  return avatarSources(safe);
}
