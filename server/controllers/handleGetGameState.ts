import { Request, Response } from "express";
import { Drop } from "../types/index.js";
import {
  DEFAULT_TIMEZONE,
  buildAccessoryLookup,
  errorHandler,
  getActiveDrops,
  getCachedInventoryItems,
  getCredentials,
  getDroppedAsset,
  getDropState,
  getEndedDrops,
  getUpcomingDrops,
  getVisitor,
  getVisitorClaims,
  hasClaimedDrop,
  isAdminVisitor,
  isDropConfigured,
  cleanDrop,
  todayInTimezone,
} from "../utils/index.js";
import type { AccessoryLookup, DropType } from "../utils/index.js";

/**
 * Every drop is reduced by `cleanDrop` before it leaves
 * here — the raw drops map holds answers and must never be returned to a non-admin.
 *
 * The admin home is the same payload; the drops list is a separate admin-only route.
 */
export const handleGetGameState = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, profileId, urlSlug } = credentials;
    const forceRefresh = req.query.forceRefreshInventory === "true";

    const droppedAsset = await getDroppedAsset(credentials);
    const dataObject = droppedAsset.dataObject;

    const timezone = dataObject.timezone || DEFAULT_TIMEZONE;
    const today = todayInTimezone(timezone);
    const drops = dataObject.drops || {};

    const visitor = await getVisitor(credentials);
    const isAdmin = isAdminVisitor(visitor);
    const claims = await getVisitorClaims(visitor, assetId);

    // Only pay for the ecosystem lookup when an accessory drop actually needs thumbnails.
    let accessoryLookup: AccessoryLookup | undefined;
    const needsAccessories = Object.values(drops).some(
      (drop) => drop.unlockType === "accessory" && drop.accessoryIds?.length,
    );
    if (needsAccessories) {
      try {
        accessoryLookup = buildAccessoryLookup(await getCachedInventoryItems({ credentials, forceRefresh }));
      } catch (error) {
        // A catalog outage shouldn't blank the whole app — cards fall back to the default icon.
        console.error("Unable to resolve accessory previews", error);
      }
    }

    // Half-configured drops are never shown to non-admin.
    const configured = (drop: Drop) => isDropConfigured(drop);
    const project = (drop: Drop, claimed?: boolean) =>
      cleanDrop({ drop, state: getDropState(drop, today), claimed, accessoryLookup });

    const upcoming = getUpcomingDrops(drops, today)
      .filter(configured)
      .map((drop) => project(drop))
      .filter(Boolean) as DropType[];

    const recentDrops = getEndedDrops(drops, today)
      .filter(configured)
      .map((drop) => project(drop, hasClaimedDrop(claims, drop, profileId)))
      .filter(Boolean) as DropType[];

    // Claimed drops stay in the feed, flagged, so the client can render them as success cards. Only
    // drops whose window has closed leave the feed — those surface in the Recent Drops strip instead.
    const active = getActiveDrops(drops, today)
      .filter(configured)
      .map((drop) => project(drop, hasClaimedDrop(claims, drop, profileId)))
      .filter(Boolean) as DropType[];

    const analytics = [
      { analyticName: "starts", profileId, urlSlug, uniqueKey: profileId },
      { analyticName: "unlock_app_opened", profileId, urlSlug, uniqueKey: profileId },
    ];
    if (upcoming.length)
      analytics.push({ analyticName: "next_unlock_viewed", profileId, urlSlug, uniqueKey: profileId });
    if (recentDrops.length)
      analytics.push({ analyticName: "recent_drops_viewed", profileId, urlSlug, uniqueKey: profileId });

    if (typeof visitor?.updateDataObject === "function") {
      visitor
        .updateDataObject({}, { analytics })
        .catch((error: any) =>
          errorHandler({ error, functionName: "handleGetGameState", message: "Error firing analytics" }),
        );
    }

    return res.json({ upcoming, recentDrops, active, isAdmin, timezone, today, success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetGameState",
      message: "Error getting unlock data",
      req,
      res,
    });
  }
};
