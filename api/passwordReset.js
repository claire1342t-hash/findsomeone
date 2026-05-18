/** Vercel Edge entry when project root is `findsomeone/`. */
export const config = { runtime: "edge" };
export { default } from "../server/passwordResetHandler.js";
