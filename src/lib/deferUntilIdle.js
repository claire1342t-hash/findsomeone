/**
 * @param {() => void} callback
 * @returns {() => void} cancel
 */
export function deferUntilIdle(callback) {
  if (typeof window === "undefined") {
    callback();
    return () => {};
  }
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 150);
  return () => window.clearTimeout(id);
}
