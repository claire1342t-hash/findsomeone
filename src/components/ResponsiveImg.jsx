const FEATURE_SIZES = "(max-width: 620px) 90vw, min(500px, 50vw)";
const BUTTON_SIZES = "300px";

/**
 * @param {{ src: string, src480?: string }} source
 * @param {"feature" | "button" | string} [layout]
 */
function buildSrcSet(source) {
  if (!source?.src) return undefined;
  if (source.src480) {
    return `${source.src480} 480w, ${source.src} 960w`;
  }
  return undefined;
}

function sizesFor(layout) {
  if (layout === "feature") return FEATURE_SIZES;
  if (layout === "button") return BUTTON_SIZES;
  return layout;
}

/**
 * @param {{ source: { src: string, src480?: string }, layout?: "feature" | "button" | string, alt?: string, className?: string, loading?: "lazy" | "eager", decoding?: "async" | "auto" | "sync", fetchPriority?: "high" | "low" | "auto", width?: number, height?: number, "aria-hidden"?: boolean }} props
 */
export function ResponsiveImg({
  source,
  layout = "feature",
  alt = "",
  className,
  loading,
  decoding = "async",
  fetchPriority,
  width,
  height,
  "aria-hidden": ariaHidden,
}) {
  const srcSet = buildSrcSet(source);
  return (
    <img
      src={source.src}
      srcSet={srcSet}
      sizes={srcSet ? sizesFor(layout) : undefined}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      width={width}
      height={height}
      aria-hidden={ariaHidden}
    />
  );
}
