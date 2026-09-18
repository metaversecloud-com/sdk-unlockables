import { DroppedAssetInterface } from "@rtsdk/topia";
import { Drop, DropsMap } from "../../types/index.js";

export const STALE_THRESHOLD_DAYS = 90;

/**
 * Subtract N days from a YYYY-MM-DD date string and return the result in the
 * same format. All arithmetic is in UTC because drop windows are date-only —
 * DST offsets are irrelevant when neither operand carries a wall-clock time.
 */
const subtractDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - days * 86400000;
  const cutoff = new Date(ms);
  const yy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cutoff.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

/**
 * Identify drops whose endDate is more than `maxDaysStale` days behind
 * `today`. Always-available drops (no endDate) and upcoming/live drops are
 * never eligible.
 */
export const findStaleDropIds = (
  drops: DropsMap | undefined,
  today: string,
  maxDaysStale: number = STALE_THRESHOLD_DAYS,
): string[] => {
  if (!drops) return [];
  const cutoff = subtractDays(today, maxDaysStale);
  return Object.entries(drops)
    .filter(([, drop]) => drop && drop.endDate && drop.endDate < cutoff)
    .map(([id]) => id);
};

/**
 * Remove any drops that ended more than STALE_THRESHOLD_DAYS days ago from the key asset's
 * data object.
 */
export const pruneStaleDrops = async ({
  droppedAsset,
  today,
  maxDaysStale = STALE_THRESHOLD_DAYS,
}: {
  droppedAsset: DroppedAssetInterface;
  today: string;
  maxDaysStale?: number;
}): Promise<{ drops: DropsMap; prunedIds: string[] }> => {
  const rawDrops = ((droppedAsset as any).dataObject?.drops || {}) as Record<string, Drop | null>;
  const prunedIds = findStaleDropIds(rawDrops as DropsMap, today, maxDaysStale);

  // Local clean map — used both as the pending write payload and as the
  // return value. Strips nulls left behind by any prior path-based deletes.
  const cleanDrops: DropsMap = {};
  for (const [id, drop] of Object.entries(rawDrops)) {
    if (!drop) continue;
    if (prunedIds.includes(id)) continue;
    cleanDrops[id] = drop;
  }

  if (prunedIds.length === 0) return { drops: cleanDrops, prunedIds: [] };

  const assetId = (droppedAsset as any).id || "asset";
  const lockId = `${assetId}-prune-${Math.round(Date.now() / 30000) * 30000}`;
  try {
    await (droppedAsset as any).updateDataObject({ drops: cleanDrops }, { lock: { lockId, releaseLock: true } });
  } catch (error) {
    console.warn(`pruneStaleDrops: failed to persist deletion of ${prunedIds.length} drop(s)`, error);
    return { drops: cleanDrops, prunedIds: [] };
  }

  return { drops: cleanDrops, prunedIds };
};
