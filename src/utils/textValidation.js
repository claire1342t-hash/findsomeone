/** Minimum meaningful length after trim (not whitespace-only). */
export const TEXT_MIN = {
  short: 2,
  story: 10,
  answer: 2,
};

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function hasMinText(value, min) {
  return normalizeText(value).length >= min;
}

/**
 * @returns {string | null} i18n key for first validation failure
 */
export function validatePostForm({
  locationDescription,
  appearance,
  story,
  question1,
  question2,
  motivation,
  customMotivation,
}) {
  if (!hasMinText(locationDescription, TEXT_MIN.short)) {
    return "post.errorLocationDescription";
  }
  if (!hasMinText(appearance, TEXT_MIN.short)) {
    return "validation.errorMinShort";
  }
  if (!hasMinText(story, TEXT_MIN.story)) {
    return "validation.errorMinStory";
  }
  if (!hasMinText(question1, TEXT_MIN.short) || !hasMinText(question2, TEXT_MIN.short)) {
    return "post.errorRequiredFields";
  }
  if (motivation === "custom" && !hasMinText(customMotivation, TEXT_MIN.short)) {
    return "post.errorCustomMotivation";
  }
  return null;
}

/**
 * @returns {string | null} i18n key
 */
export function validateMapVerifyAnswers(answer1, answer2) {
  if (!hasMinText(answer1, TEXT_MIN.answer) || !hasMinText(answer2, TEXT_MIN.answer)) {
    return "validation.errorMinAnswer";
  }
  return null;
}
