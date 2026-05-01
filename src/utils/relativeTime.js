/**
 * Whole local-calendar days from `past` (midnight) to `now` (midnight).
 * 0 = same calendar day, 1 = previous calendar day (yesterday), 2 = two days ago, etc.
 */
export function localCalendarDaysBefore(past, now = new Date()) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const msPerDay = 86400000;
  const diff = Math.floor((startOf(now).getTime() - startOf(past).getTime()) / msPerDay);
  return Math.max(0, diff);
}

/** Map list / coarse: Today, Yesterday, or "X days ago" (calendar-based). */
export function formatRelativeCalendarDay(value, language, now = new Date()) {
  if (!value?.toDate) return "—";
  const past = value.toDate();
  const d = localCalendarDaysBefore(past, now);
  if (d === 0) {
    if (language === "en") return "Today";
    if (language === "ja") return "今日";
    return "今天";
  }
  if (d === 1) {
    if (language === "en") return "Yesterday";
    if (language === "ja") return "昨日";
    return "昨天";
  }
  if (language === "en") return `${d}d ago`;
  if (language === "ja") return `${d}日前`;
  return `${d}天前`;
}

/**
 * Finer relative time: minutes / hours within the same local day, then calendar
 * Today (same day) / Yesterday / X days ago for older calendar days.
 */
export function formatRelativeSmart(value, language, now = new Date(), emptyFallback = "—") {
  if (!value?.toDate) return emptyFallback;
  const past = value.toDate();
  const diffMs = Math.max(0, now.getTime() - past.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    if (language === "en") return "Just now";
    if (language === "ja") return "たった今";
    return "剛剛";
  }
  if (diffMinutes < 60) {
    if (language === "en") return `${diffMinutes}m ago`;
    if (language === "ja") return `${diffMinutes}分前`;
    return `${diffMinutes}分鐘前`;
  }

  const calendarD = localCalendarDaysBefore(past, now);

  if (calendarD === 0) {
    const hr = Math.floor(diffMinutes / 60);
    if (language === "en") return `${hr}h ago`;
    if (language === "ja") return `${hr}時間前`;
    return `${hr}小時前`;
  }
  if (calendarD === 1) {
    if (language === "en") return "Yesterday";
    if (language === "ja") return "昨日";
    return "昨天";
  }
  if (language === "en") return `${calendarD}d ago`;
  if (language === "ja") return `${calendarD}日前`;
  return `${calendarD}天前`;
}
