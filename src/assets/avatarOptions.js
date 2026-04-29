import avatar1 from "./illustrations/profile_picture/1.png";
import avatar2 from "./illustrations/profile_picture/2.png";
import avatar3 from "./illustrations/profile_picture/3.png";
import avatar4 from "./illustrations/profile_picture/4.png";
import avatar5 from "./illustrations/profile_picture/5.png";
import avatar6 from "./illustrations/profile_picture/6.png";
import avatar7 from "./illustrations/profile_picture/7.png";
import avatar8 from "./illustrations/profile_picture/8.png";
import avatar9 from "./illustrations/profile_picture/9.png";
import avatar10 from "./illustrations/profile_picture/10.png";
import avatar11 from "./illustrations/profile_picture/11.png";
import avatar12 from "./illustrations/profile_picture/12.png";

export const AVATAR_OPTIONS = [
  { id: 1, src: avatar1 },
  { id: 2, src: avatar2 },
  { id: 3, src: avatar3 },
  { id: 4, src: avatar4 },
  { id: 5, src: avatar5 },
  { id: 6, src: avatar6 },
  { id: 7, src: avatar7 },
  { id: 8, src: avatar8 },
  { id: 9, src: avatar9 },
  { id: 10, src: avatar10 },
  { id: 11, src: avatar11 },
  { id: 12, src: avatar12 },
];

export function getAvatarById(id) {
  const normalized = Number(id);
  return AVATAR_OPTIONS.find((item) => item.id === normalized)?.src ?? AVATAR_OPTIONS[0].src;
}
