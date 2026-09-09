const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date-only string (YYYY-MM-DD) as "Oct 31".
 *
 * Parsed by hand rather than through `new Date(iso)`: that treats a date-only string as UTC midnight,
 * so a browser in a negative-offset timezone would render "Oct 31" as "Oct 30". The drop's dates are
 * already resolved in the instance timezone server-side — there is nothing left to convert.
 */
export const formatDropDate = (date?: string | null): string => {
  if (!date) return "";

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return "";

  return `${MONTHS[month - 1]} ${day}`;
};

/** "Oct 1 – Oct 31", or a single date, or "No dates" when always available. */
export const formatDropRange = (startDate?: string | null, endDate?: string | null): string => {
  const start = formatDropDate(startDate);
  const end = formatDropDate(endDate);

  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "No dates";
};

/** "Nov 1 to Nov 30", the phrasing used in the upcoming strip. */
export const formatUpcomingRange = (startDate?: string | null, endDate?: string | null): string => {
  const start = formatDropDate(startDate);
  const end = formatDropDate(endDate);

  if (start && end) return `${start} to ${end}`;
  if (start) return `from ${start}`;
  return end ? `until ${end}` : "";
};
