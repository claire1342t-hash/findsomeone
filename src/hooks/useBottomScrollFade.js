import { useCallback, useEffect, useRef, useState } from "react";

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
 * Layout reads are batched in rAF; state updates only when visibility changes.
 * @param {string|number} layoutKey Recheck when content/layout meaningfully changes.
 */
export function useBottomScrollFade(layoutKey) {
  const ref = useRef(null);
  const [showFade, setShowFade] = useState(false);
  const showFadeRef = useRef(false);
  const rafIdRef = useRef(0);

  const commitMeasure = useCallback(() => {
    const next = computeShowFade(ref.current);
    if (next === showFadeRef.current) return;
    showFadeRef.current = next;
    setShowFade(next);
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      commitMeasure();
    });
  }, [commitMeasure]);

  useEffect(() => {
    scheduleMeasure();
    const el = ref.current;
    if (!el) return undefined;

    const onScroll = () => scheduleMeasure();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [scheduleMeasure, layoutKey]);

  return { ref, showFade };
}
