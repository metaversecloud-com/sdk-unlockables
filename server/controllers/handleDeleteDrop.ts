import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, requireAdmin } from "../utils/index.js";

export const handleDeleteDrop = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, profileId, urlSlug } = credentials;
    const { dropId } = req.params;

    if (!(await requireAdmin(credentials, res))) return;

    const droppedAsset = await getDroppedAsset(credentials);
    const drops = droppedAsset.dataObject.drops || {};

    if (!drops[dropId]) return res.status(404).json({ success: false, message: "That drop no longer exists." });

    // A data object key can't be removed by path, so the map is rewritten without it
    const remaining = { ...drops };
    delete remaining[dropId];

    const lockId = `${assetId}-delete-${Math.round(Date.now() / 1000)}`;
    await droppedAsset.updateDataObject(
      { drops: remaining },
      {
        analytics: [{ analyticName: "drop_config_changed", profileId, uniqueKey: profileId, urlSlug }],
        lock: { lockId, releaseLock: true },
      },
    );

    return res.json({ success: true, message: "Drop deleted" });
  } catch (error) {
    return errorHandler({ error, functionName: "handleDeleteDrop", message: "Error deleting drop", req, res });
  }
};
