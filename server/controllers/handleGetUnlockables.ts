import { Request, Response } from "express";
import { InventoryItemInterface } from "@rtsdk/topia";
import {
  DEFAULT_ICONS,
  errorHandler,
  getBadges,
  getCachedInventoryItems,
  getCredentials,
  requireAdmin,
} from "../utils/index.js";

interface UnlockableInventoryItem extends InventoryItemInterface {
  metadata?: {
    packId?: string;
    category?: string;
    accessory?: string;
    [key: string]: any;
  };
}

interface Expression {
  id: string;
  name: string;
  expressionImage?: string;
  type: string;
}

/**
 * Everything the drop editor can offer as a reward: unlockable emotes, accessory packs, and badges.
 */
export const handleGetUnlockables = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const forceRefresh = req.query.forceRefreshInventory === "true";

    const visitor = await requireAdmin(credentials, res);
    if (!visitor) return;

    const [allInventoryItems, badges] = await Promise.all([
      getCachedInventoryItems({ credentials, forceRefresh }) as Promise<UnlockableInventoryItem[]>,
      getBadges(credentials, forceRefresh),
    ]);

    const availableExpressions = (await visitor.getExpressions({ getUnlockablesOnly: true })) as Expression[];

    const emotes = availableExpressions.map((expression) => ({
      id: expression.id,
      name: expression.name,
      type: expression.type,
      previewUrl: expression.expressionImage || DEFAULT_ICONS.emote,
    }));

    const packItems = allInventoryItems?.filter((item) => item.type === "AVATAR_ACCESSORY_PACK") || [];
    const accessories = allInventoryItems?.filter((item) => item.type === "ACCESSORY") || [];

    const packs = packItems.map((pack) => {
      const packId = pack.metadata?.packId;
      const packAccessories = accessories
        .filter((accessory) => accessory.metadata?.packId === packId)
        .map((accessory) => ({
          id: accessory.id,
          name: accessory.metadata?.displayName || accessory.name,
          category: accessory.metadata?.category || "",
          previewUrl: accessory.image_path || DEFAULT_ICONS.accessory,
        }));

      return {
        id: pack.id,
        name: pack.name,
        description: pack.description || "",
        previewUrl: pack.image_path || DEFAULT_ICONS.accessory,
        packId,
        accessories: packAccessories,
      };
    });

    return res.json({ emotes, packs, badges, success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetUnlockables",
      message: "Error getting unlockables",
      req,
      res,
    });
  }
};
