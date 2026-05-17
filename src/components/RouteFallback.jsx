export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <p className="route-fallback__text">Loading…</p>
    </div>
  );
}
