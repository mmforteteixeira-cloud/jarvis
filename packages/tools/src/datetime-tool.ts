export interface DateTimeInfo {
  iso: string;
  date: string;
  time: string;
  weekday: string;
  timezone: string;
}

/** Current date/time, formatted for direct display — no external API needed. */
export function getCurrentDateTime(locale = "en-US", timeZone?: string): DateTimeInfo {
  const now = new Date();
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    iso: now.toISOString(),
    date: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: tz }).format(now),
    time: new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone: tz }).format(now),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: tz }).format(now),
    timezone: tz,
  };
}
