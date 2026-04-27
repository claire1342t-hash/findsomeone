import { useEffect, useState } from "react";

export function CustomCursor() {
  const [cursor, setCursor] = useState({
    x: 0,
    y: 0,
    enlarged: false,
    visible: false,
  });

  useEffect(() => {
    const onMouseMove = (event) => {
      const linkHovered = Boolean(event.target.closest("a"));
      setCursor({
        x: event.clientX,
        y: event.clientY,
        enlarged: linkHovered,
        visible: true,
      });
    };

    const onMouseLeaveWindow = () => {
      setCursor((prev) => ({ ...prev, visible: false, enlarged: false }));
    };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeaveWindow);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeaveWindow);
    };
  }, []);

  return (
    <span
      className={`custom-cursor${cursor.enlarged ? " is-enlarged" : ""}${
        cursor.visible ? " is-visible" : ""
      }`}
      style={{ left: cursor.x, top: cursor.y }}
      aria-hidden="true"
    />
  );
}
