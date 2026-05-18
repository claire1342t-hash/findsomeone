/** Canonical report reason codes stored in Firestore. */
export const DEFAULT_REPORT_REASON = "inappropriate";

export const REPORT_REASON_OPTIONS = [
  { value: "inappropriate", labelKey: "report.reason.inappropriate" },
  { value: "harassment", labelKey: "report.reason.harassment" },
  { value: "spam", labelKey: "report.reason.spam" },
  { value: "other", labelKey: "report.reason.other" },
];

/** Legacy Chinese labels from earlier builds. */
const LEGACY_REPORT_REASON_TO_CODE = {
  不當內容: "inappropriate",
  騷擾: "harassment",
  垃圾訊息: "spam",
  其他: "other",
};

/**
 * @param {string} reason
 * @param {string} [detail]
 * @param {(key: string) => string} t
 */
export function formatReportReason(reason, detail, t) {
  const code = LEGACY_REPORT_REASON_TO_CODE[reason] || reason;
  if (code === "other") {
    const trimmed = String(detail || "").trim();
    return trimmed || t("report.reason.other");
  }
  const key = `report.reason.${code}`;
  const translated = t(key);
  return translated !== key ? translated : reason;
}

export function isOtherReportReason(reason) {
  const code = LEGACY_REPORT_REASON_TO_CODE[reason] || reason;
  return code === "other";
}
