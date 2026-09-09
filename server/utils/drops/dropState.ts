import { Drop, DropState, DropsMap } from "../../types/index.js";

export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * Today's date as YYYY-MM-DD in the given IANA timezone.
 *
 * Drop windows are date-only, so comparing YYYY-MM-DD strings lexicographically gives the right
 * answer without any DST or offset arithmetic — and without pulling in a date library. Falls back to
 * the default timezone if the configured one is not a valid IANA name (Intl throws RangeError).
 */
export const todayInTimezone = (timezone?: string): string => {
  const resolve = (tz: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };

  try {
    return resolve(timezone || DEFAULT_TIMEZONE);
  } catch {
    console.warn(`Invalid timezone "${timezone}", falling back to ${DEFAULT_TIMEZONE}`);
    return resolve(DEFAULT_TIMEZONE);
  }
};

/**
 * A drop with neither date is always available. Otherwise the window is [startDate, endDate] with
 * endDate INCLUSIVE — an endDate of Oct 31 stays claimable through all of Oct 31, matching what the
 * admin typed and what the users reads on the "Ends Oct 31" chip.
 */
export const getDropState = (drop: Drop, today: string): DropState => {
  const { startDate, endDate } = drop;

  if (!startDate && !endDate) return "always";
  if (startDate && today < startDate) return "upcoming";
  if (endDate && today > endDate) return "ended";

  return "live";
};

export const isDropClaimable = (state: DropState): boolean => state === "live" || state === "always";

const asList = (drops?: DropsMap): Drop[] => Object.values(drops || {});

/**
 * Admin list order: always-available pinned first, then by start date.
 */
export const sortDropsForAdmin = (drops: DropsMap | undefined, today: string): Drop[] =>
  asList(drops).sort((a, b) => {
    const aAlways = getDropState(a, today) === "always";
    const bAlways = getDropState(b, today) === "always";
    if (aAlways !== bAlways) return aAlways ? -1 : 1;
    return (a.startDate || "").localeCompare(b.startDate || "");
  });

/**
 * Active feed order: live drops soonest-ending first, then always-available drops.
 * Callers are responsible for filtering out drops the visitor has already claimed.
 */
export const getActiveDrops = (drops: DropsMap | undefined, today: string): Drop[] => {
  const live = asList(drops).filter((d) => getDropState(d, today) === "live");
  const always = asList(drops).filter((d) => getDropState(d, today) === "always");

  live.sort((a, b) => {
    // A live drop with no end date never expires — sort it after the ones that do.
    if (!a.endDate) return b.endDate ? 1 : 0;
    if (!b.endDate) return -1;
    return a.endDate.localeCompare(b.endDate);
  });

  always.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  return [...live, ...always];
};

/**
 * The most recently ended drops, newest first, capped. Never padded — fewer ended drops means
 * fewer entries, and zero means the band is absent entirely.
 */
export const getEndedDrops = (drops: DropsMap | undefined, today: string, limit = 3): Drop[] =>
  asList(drops)
    .filter((d) => getDropState(d, today) === "ended")
    .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""))
    .slice(0, limit);

/**
 * The next drops tagged "show in upcoming", by start date, capped. Untagged upcoming drops are
 * deliberately excluded — they must not appear anywhere until they go live.
 */
export const getUpcomingDrops = (drops: DropsMap | undefined, today: string, limit = 3): Drop[] =>
  asList(drops)
    .filter((d) => getDropState(d, today) === "upcoming" && d.showInUpcoming)
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .slice(0, limit);
