export const afghanSolarHijriMonths = [
  "حمل",
  "ثور",
  "جوزا",
  "سرطان",
  "اسد",
  "سنبله",
  "میزان",
  "عقرب",
  "قوس",
  "جدی",
  "دلو",
  "حوت",
] as const;

export interface SolarHijriDateParts {
  year: number;
  month: number;
  day: number;
}

const solarHijriPartsFormatter = new Intl.DateTimeFormat(
  "fa-AF-u-ca-persian-nu-latn",
  {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  },
);

const dariNumberFormatter = new Intl.NumberFormat("fa-AF", {
  useGrouping: false,
});

export function getSolarHijriParts(isoDate: string): SolarHijriDateParts {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = solarHijriPartsFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function formatSolarHijriDate(isoDate: string): string {
  const { year, month, day } = getSolarHijriParts(isoDate);
  const monthName = afghanSolarHijriMonths[month - 1];
  if (!monthName) return isoDate;
  return `${dariNumberFormatter.format(day)} ${monthName} ${dariNumberFormatter.format(year)}`;
}

export function formatSolarHijriMonthYear(year: number, month: number): string {
  const monthName = afghanSolarHijriMonths[month - 1];
  if (!monthName) return `${year}-${month}`;
  return `${monthName} ${dariNumberFormatter.format(year)}`;
}

export function formatConfiguredDate(isoDate: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  try {
    const cached = localStorage.getItem("discipline_app_settings");
    const calendar = cached ? (JSON.parse(cached) as { date_calendar?: { calendar?: string } }).date_calendar?.calendar : "solar";
    if (calendar !== "gregorian") {
      const base = formatSolarHijriDate(isoDate);
      if (!options.weekday) return base;
      const [solarYear, solarMonth, solarDay] = isoDate.split("-").map(Number);
      const weekday = new Intl.DateTimeFormat("fa-AF", { weekday: options.weekday, timeZone: "UTC" }).format(new Date(Date.UTC(solarYear, solarMonth - 1, solarDay, 12)));
      return `${weekday} · ${base}`;
    }
  } catch {
    return formatSolarHijriDate(isoDate);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...options, calendar: "gregory", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
