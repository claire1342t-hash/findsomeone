import { useState } from "react";
import { ResponsiveImg } from "./ResponsiveImg.jsx";

const CAN_HOVER =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Default illustration + hover (desktop only; hover asset loads on first pointer hover).
 * @param {{ defaultImage: { src: string, src480?: string }, hoverImage: { src: string, src480?: string } }} props
 */
export function FeatureCardImages({ defaultImage, hoverImage }) {
  const [hoverReady, setHoverReady] = useState(false);

  const activateHover = () => {
    if (CAN_HOVER) setHoverReady(true);
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
      {CAN_HOVER ? (
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
