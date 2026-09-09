import { Request, Response } from "express";
import {
  buildDropFromInput,
  errorHandler,
  getCredentials,
  getDroppedAsset,
  requireAdmin,
  uploadEmotePreview,
  validateDropInput,
} from "../utils/index.js";
import type { DropInput } from "../utils/index.js";

/**
 * Create (`POST /drops`) or update (`PUT /drops/:dropId`) a single drop.
 *
 * The whole `drops.<id>` object is replaced, so fields belonging to a previously-chosen unlock type
 * or question type don't linger. Engagement data survives — `buildDropFromInput` carries it over from
 * the existing drop.
 */
export const handleSaveDrop = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId, urlSlug } = credentials;
    const { dropId } = req.params;

    if (!(await requireAdmin(credentials, res))) return;

    const droppedAsset = await getDroppedAsset(credentials);
    const existingDrops = droppedAsset.dataObject.drops || {};

    const existing = dropId ? existingDrops[dropId] : undefined;
    if (dropId && !existing) {
      return res.status(404).json({ success: false, message: "That drop no longer exists." });
    }

    const input = (req.body || {}) as DropInput;

    // Mirror a newly-chosen emote preview into our bucket. Skipped when the URL is already ours, so
    // re-saving an unchanged drop doesn't re-upload.
    if (input.unlockType === "emote" && input.itemPreviewUrl && !input.itemPreviewUrl.includes(".s3.")) {
      input.itemPreviewUrl = await uploadEmotePreview({
        name: input.itemName || input.itemId || "emote",
        previewUrl: input.itemPreviewUrl,
      });
    }

    const drop = buildDropFromInput({ input, existing });

    const validationError = validateDropInput(drop);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    await droppedAsset.updateDataObject(
      { [`drops.${drop.id}`]: drop },
      {
        analytics: [
          { analyticName: "new_configurations", uniqueKey: profileId, urlSlug },
          { analyticName: "drop_config_changed", profileId, uniqueKey: profileId, urlSlug },
        ],
      },
    );

    return res.json({ drop, success: true, message: "Drop saved successfully" });
  } catch (error) {
    return errorHandler({ error, functionName: "handleSaveDrop", message: "Error saving drop", req, res });
  }
};
