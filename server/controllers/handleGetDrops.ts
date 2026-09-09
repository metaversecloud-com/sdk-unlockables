import { Request, Response } from "express";
import {
  DEFAULT_TIMEZONE,
  buildAccessoryLookup,
  errorHandler,
  getCachedInventoryItems,
  getCredentials,
  getDroppedAsset,
  getDropState,
  isDropConfigured,
  requireAdmin,
  resolveDropItem,
  sortDropsForAdmin,
  todayInTimezone,
} from "../utils/index.js";
import type { AccessoryLookup } from "../utils/index.js";

/**
 * The admin drops list. Returns full drop configuration — including answers — so this route is
 * admin-only.
 */
export const handleGetDrops = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const forceRefresh = req.query.forceRefreshInventory === "true";

    if (!(await requireAdmin(credentials, res))) return;

    const droppedAsset = await getDroppedAsset(credentials);
    const dataObject = droppedAsset.dataObject;

    const timezone = dataObject.timezone || DEFAULT_TIMEZONE;
    const today = todayInTimezone(timezone);
    const drops = dataObject.drops || {};

    let accessoryLookup: AccessoryLookup | undefined;
    if (Object.values(drops).some((drop) => drop.unlockType === "accessory" && drop.accessoryIds?.length)) {
      try {
        accessoryLookup = buildAccessoryLookup(await getCachedInventoryItems({ credentials, forceRefresh }));
      } catch (error) {
        console.error("Unable to resolve accessory previews", error);
      }
    }

    const rows = sortDropsForAdmin(drops, today).map((drop) => {
      const { itemName, itemPreviewUrl, accessories } = resolveDropItem(drop, accessoryLookup);

      return {
        ...drop,
        state: getDropState(drop, today),
        isConfigured: isDropConfigured(drop),
        resolvedItemName: itemName,
        resolvedItemPreviewUrl: itemPreviewUrl,
        accessories,
      };
    });

    return res.json({ drops: rows, timezone, today, success: true });
  } catch (error) {
    return errorHandler({ error, functionName: "handleGetDrops", message: "Error getting drops", req, res });
  }
};
