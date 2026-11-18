// Builders for the key asset's data object (schema v2: a map of scheduled drops) and the dates the
// app compares drop windows against.
import { KEY_ASSET_ID } from "../../fixtures";

/** The app's default timezone for drop windows (dataObject.timezone). */
export const APP_TIMEZONE = "America/Chicago";

/** YYYY-MM-DD, `offset` days from today in `timezone`, the way the server computes "today". */
export const day = (offset = 0, timezone = APP_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};

export type Drop = Record<string, any> & { id: string };

/** A configured, always-available emote drop answered with the text "Pirate". */
export const drop = (id: string, fields: Record<string, any> = {}): Drop => ({
  id,
  unlockType: "emote",
  itemId: "emote-wave",
  itemName: "Wave",
  itemPreviewUrl: "https://topia-e2e.s3.amazonaws.com/wave.png",
  challengeName: `Challenge ${id}`,
  itemDescription: `Question for ${id}`,
  questionType: "text",
  password: "pirate",
  startDate: null,
  endDate: null,
  showInUpcoming: false,
  upcomingDisplay: "item",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  stats: { attempts: 0, unlockCount: 0 },
  ...fields,
});

export const badgeDrop = (id: string, fields: Record<string, any> = {}) =>
  drop(id, { unlockType: "badge", itemId: undefined, itemName: undefined, itemPreviewUrl: undefined, badgeId: "badge-1", badgeName: "Perfect Score", badgeIcon: "https://example.invalid/badges/1.png", ...fields });

export const accessoryDrop = (id: string, fields: Record<string, any> = {}) =>
  drop(id, {
    unlockType: "accessory",
    itemId: undefined,
    itemName: "Pirate Pack",
    itemPreviewUrl: "https://example.invalid/packs/pirate.png",
    packId: "pack-pirate",
    accessoryIds: ["acc-hat", "acc-patch"],
    accessoryNames: ["Pirate Hat", "Eye Patch"],
    ...fields,
  });

/** The key asset's data object holding `drops`, already initialized for this asset. */
export const unlockData = (drops: Drop[], extra: Record<string, any> = {}) => ({
  schemaVersion: 2,
  timezone: APP_TIMEZONE,
  statsOwnerAssetId: KEY_ASSET_ID,
  drops: Object.fromEntries(drops.map((d) => [d.id, JSON.parse(JSON.stringify(d))])),
  ...extra,
});

/** A visitor data object recording claims of `dropIds` on the key asset. */
export const claimed = (...dropIds: string[]) => ({
  claims: { [KEY_ASSET_ID]: Object.fromEntries(dropIds.map((id) => [id, "2026-01-01T00:00:00.000Z"])) },
});
