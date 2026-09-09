import { DroppedAsset } from "@rtsdk/topia";
import { UnlockDataObject } from "./Drop.js";

export interface IDroppedAsset extends DroppedAsset {
  dataObject: UnlockDataObject;
}
