const webpModules = import.meta.glob("../assets/illustrations/**/*.webp", {
  eager: true,
  import: "default",
});

/**
 * @param {string} name e.g. "map-1" or "profile_picture/3"
 * @returns {{ src: string, src480?: string }}
 */
export function illustration(name) {
  const base = `../assets/illustrations/${name}.webp`;
  const small = `../assets/illustrations/${name}-480w.webp`;
  return {
    src: webpModules[base],
    src480: webpModules[small],
  };
}
