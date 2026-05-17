import { useLayoutEffect, useState } from "react";
import { ResponsiveImg } from "./ResponsiveImg.jsx";

/**
 * Default illustration + hover (desktop only; hover asset loads on first pointer hover).
 * @param {{ defaultImage: { src: string, src480?: string }, hoverImage: { src: string, src480?: string } }} props
 */
export function FeatureCardImages({ defaultImage, hoverImage }) {
  const [hoverReady, setHoverReady] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useLayoutEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const activateHover = () => {
    if (canHover) setHoverReady(true);
  };

  return (
    <div className="feature-image-wrap" onPointerEnter={activateHover} onFocus={activateHover}>
      <ResponsiveImg
        source={defaultImage}
        layout="feature"
        className="feature-image default"
        alt=""
        aria-hidden
        loading="lazy"
      />
      {canHover ? (
        <ResponsiveImg
          source={hoverReady ? hoverImage : defaultImage}
          layout="feature"
          className="feature-image hover"
          alt=""
          aria-hidden
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
