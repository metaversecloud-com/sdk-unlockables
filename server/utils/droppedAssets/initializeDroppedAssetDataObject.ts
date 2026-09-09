import { IDroppedAsset, UnlockDataObject } from "../../types/index.js";
import { errorHandler } from "../errorHandler.js";
import { DEFAULT_TIMEZONE } from "../drops/dropState.js";
import {
  SCHEMA_VERSION,
  buildStatsResetUpdates,
  hasLegacyConfig,
  migrateLegacyToDropsMap,
} from "../drops/migrateToV2.js";

const buildLockId = (assetId: string) => {
  // Minute-granular timestamp, matching the existing convention, so concurrent callers within the
  // same minute contend for one lock rather than each acquiring their own.
  const timestamp = Math.round(Date.now() / 60000);
  return `${assetId}-${timestamp}`;
};

/**
 * Bring the dropped asset's data object up to schemaVersion 2.
 *
 * Three cases, at most one write:
 *  1. Fresh install      — seed the empty v2 shape.
 *  2. Legacy v1 config   — collapse it into a single always-available drop.
 *  3. Copied asset       — `statsOwnerAssetId` doesn't match, so the config arrived with the asset
 *                          from another world. Keep the config, zero the engagement data.
 */
export const initializeDroppedAssetDataObject = async (droppedAsset: IDroppedAsset, assetId: string) => {
  try {
    await droppedAsset.fetchDataObject();

    const dataObject = (droppedAsset?.dataObject || {}) as UnlockDataObject;
    const lockId = buildLockId(assetId);
    const warn = () => console.warn("Unable to acquire lock, another process may be updating the data object");

    // --- 1. Fresh install ---------------------------------------------------------------------
    if (!dataObject.drops && !hasLegacyConfig(dataObject)) {
      await droppedAsset
        .setDataObject(
          {
            schemaVersion: SCHEMA_VERSION,
            timezone: DEFAULT_TIMEZONE,
            statsOwnerAssetId: assetId,
            drops: {},
          },
          { lock: { lockId, releaseLock: true } },
        )
        .catch(warn);

      return;
    }

    // --- 2. Legacy v1 -> v2 -------------------------------------------------------------------
    if (!dataObject.drops) {
      // The legacy shape has no `statsOwnerAssetId`, so an in-place upgrade and a copied legacy
      // asset are indistinguishable here. Keeping the stats is the safer default: the common case is
      // upgrading an existing install, where the counts are real. Stamping the id now means every
      // copy made after this point is detected correctly by case 3.
      await droppedAsset
        .updateDataObject(
          {
            schemaVersion: SCHEMA_VERSION,
            timezone: dataObject.timezone || DEFAULT_TIMEZONE,
            statsOwnerAssetId: assetId,
            drops: migrateLegacyToDropsMap(dataObject),
          },
          { lock: { lockId, releaseLock: true } },
        )
        .catch(warn);

      return;
    }

    // --- 3. Asset copied into a new world -----------------------------------------------------
    if (dataObject.statsOwnerAssetId !== assetId) {
      await droppedAsset
        .updateDataObject(buildStatsResetUpdates(dataObject.drops, assetId), {
          lock: { lockId, releaseLock: true },
        })
        .catch(warn);

      return;
    }

    // --- Already current, but backfill a missing timezone -------------------------------------
    if (!dataObject.timezone) {
      await droppedAsset
        .updateDataObject({ timezone: DEFAULT_TIMEZONE }, { lock: { lockId, releaseLock: true } })
        .catch(warn);
    }

    return;
  } catch (error) {
    errorHandler({
      error,
      functionName: "initializeDroppedAssetDataObject",
      message: "Error initializing dropped asset data object",
    });
    return await droppedAsset.fetchDataObject();
  }
};
