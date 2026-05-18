import { messages } from "../i18n/messages.js";

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

function pickMessage(language, key) {
  const table = messages[language] || messages.zh;
  if (table && Object.prototype.hasOwnProperty.call(table, key)) {
    return table[key];
  }
  return messages.zh[key] ?? key;
}

function formatMessage(language, key, vars = {}) {
  let text = pickMessage(language, key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** Map list / coarse: Today, Yesterday, or "X days ago" (calendar-based). */
export function formatRelativeCalendarDay(value, language, now = new Date()) {
  if (!value?.toDate) return "—";
  const past = value.toDate();
  const d = localCalendarDaysBefore(past, now);
  if (d === 0) return formatMessage(language, "time.today");
  if (d === 1) return formatMessage(language, "time.yesterday");
  return formatMessage(language, "time.daysAgo", { n: d });
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
    return formatMessage(language, "time.justNow");
  }
  if (diffMinutes < 60) {
    return formatMessage(language, "time.minutesAgo", { n: diffMinutes });
  }

  const calendarD = localCalendarDaysBefore(past, now);

  if (calendarD === 0) {
    const hr = Math.floor(diffMinutes / 60);
    return formatMessage(language, "time.hoursAgo", { n: hr });
  }
  if (calendarD === 1) {
    return formatMessage(language, "time.yesterday");
  }
  return formatMessage(language, "time.daysAgo", { n: calendarD });
}
