import { Credentials, IDroppedAsset } from "../../types/index.js";
import { errorHandler } from "../errorHandler.js";
import { DroppedAsset } from "../topiaInit.js";
import { initializeDroppedAssetDataObject } from "./initializeDroppedAssetDataObject.js";

export const getDroppedAsset = async (credentials: Credentials): Promise<IDroppedAsset> => {
  try {
    const { assetId, urlSlug } = credentials;

    const droppedAsset = await DroppedAsset.get(assetId, urlSlug, { credentials }) as IDroppedAsset;
    await initializeDroppedAssetDataObject(droppedAsset, assetId);

    if (!droppedAsset) throw "Dropped asset not found";

    await droppedAsset.fetchDataObject();

    return droppedAsset;
  } catch (error) {
    errorHandler({
      error,
      functionName: "getDroppedAsset",
      message: "Error getting dropped asset",
    });
    throw error;
  }
};
