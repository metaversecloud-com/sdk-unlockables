import { Request, Response } from "express";
import { Drop } from "../types/index.js";
import { createDropId, errorHandler, getCredentials, getDroppedAsset, requireAdmin } from "../utils/index.js";

/**
 * Copy a drop's full configuration into a new one. Dates are cleared — the copy lands as
 * always-available for the admin to schedule — and engagement data starts empty.
 */
export const handleDuplicateDrop = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId, urlSlug } = credentials;
    const { dropId } = req.params;

    if (!(await requireAdmin(credentials, res))) return;

    const droppedAsset = await getDroppedAsset(credentials);
    const source = droppedAsset.dataObject.drops?.[dropId];

    if (!source) return res.status(404).json({ success: false, message: "That drop no longer exists." });

    const now = new Date().toISOString();
    const copy: Drop = {
      ...source,
      id: createDropId(),
      startDate: null,
      endDate: null,
      createdAt: now,
      updatedAt: now,
      stats: { attempts: 0, unlockCount: 0 },
      responses: {},
      legacyUnlockedProfileIds: undefined,
    };

    await droppedAsset.updateDataObject(
      { [`drops.${copy.id}`]: copy },
      { analytics: [{ analyticName: "drop_config_changed", profileId, uniqueKey: profileId, urlSlug }] },
    );

    return res.json({ drop: copy, success: true, message: "Drop duplicated" });
  } catch (error) {
    return errorHandler({ error, functionName: "handleDuplicateDrop", message: "Error duplicating drop", req, res });
  }
};
