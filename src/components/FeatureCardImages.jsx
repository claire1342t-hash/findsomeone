import { ResponsiveImg } from "./ResponsiveImg.jsx";

/**
 * @param {{ image: { src: string, src480?: string } }} props
 */
export function FeatureCardImages({ image }) {
  return (
    <div className="feature-image-wrap">
      <ResponsiveImg
        source={image}
        layout="feature"
        className="feature-image"
        alt=""
        aria-hidden
        loading="lazy"
      />
    </div>
  );
}
