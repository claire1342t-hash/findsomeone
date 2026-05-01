import { useCallback, useLayoutEffect, useRef, useState } from "react";

const EPS = 2;

function computeShowFade(el) {
  if (!el) return false;
  const { scrollTop, scrollHeight, clientHeight } = el;
  const canScroll = scrollHeight > clientHeight + EPS;
  const atBottom = scrollTop + clientHeight >= scrollHeight - EPS;
  return canScroll && !atBottom;
}

/**
 * Bottom fade when the element scrolls and is not at the bottom.
 * @param {string|number} layoutKey Recheck when content/layout meaningfully changes.
 */
export function useBottomScrollFade(layoutKey) {
  const ref = useRef(null);
  const [showFade, setShowFade] = useState(false);

  const measure = useCallback(() => {
    setShowFade(computeShowFade(ref.current));
  }, []);

  const onScroll = useCallback(() => {
    setShowFade(computeShowFade(ref.current));
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, layoutKey]);

  return { ref, onScroll, showFade };
}
