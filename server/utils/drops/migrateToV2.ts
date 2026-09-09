import { randomUUID } from "crypto";
import { Drop, DropsMap, QuestionType, UnlockDataObject, UnlockType } from "../../types/index.js";

export const SCHEMA_VERSION = 2;

export const createDropId = (): string => `drop-${randomUUID()}`;

/** A blank always-available drop, used by `+ Add drop`. */
export const createDrop = (overrides: Partial<Drop> = {}): Drop => {
  const now = new Date().toISOString();
  return {
    id: createDropId(),
    unlockType: "emote",
    itemDescription: "",
    questionType: "text",
    startDate: null,
    endDate: null,
    showInUpcoming: false,
    upcomingDisplay: "item",
    createdAt: now,
    updatedAt: now,
    stats: { attempts: 0, unlockCount: 0 },
    ...overrides,
  };
};

/** True if the data object holds a v1 single-challenge configuration. */
export const hasLegacyConfig = (dataObject?: UnlockDataObject): boolean =>
  !!(dataObject?.emoteId || dataObject?.itemId || dataObject?.accessoryIds?.length || dataObject?.unlockType);

/**
 * Collapse a v1 single-challenge data object into one always-available drop.
 *
 * `stats.successfulUnlocks` collapses to an aggregate `unlockCount`, but the profile ids are kept in
 * `legacyUnlockedProfileIds` so users who already unlocked the original challenge don't see it
 * reappear as unclaimed. Nothing ever writes to that array again — it only shrinks, when a drop is
 * deleted.
 */
export const migrateLegacyToDrop = (dataObject: UnlockDataObject): Drop => {
  const unlockType: UnlockType =
    dataObject.unlockType === "accessory" || dataObject.unlockType === "badge" ? dataObject.unlockType : "emote";

  const unlockedProfileIds = Object.keys(dataObject.stats?.successfulUnlocks || {});

  return createDrop({
    unlockType,
    itemId: dataObject.itemId || dataObject.emoteId,
    itemName: dataObject.itemName || dataObject.emoteName,
    itemPreviewUrl: dataObject.itemPreviewUrl || dataObject.emotePreviewUrl,
    packId: dataObject.packId,
    accessoryIds: dataObject.accessoryIds,
    itemDescription: dataObject.itemDescription || dataObject.emoteDescription || "",
    questionType: (dataObject.questionType as QuestionType) || "text",
    password: dataObject.password,
    options: dataObject.options,
    correctAnswers: dataObject.correctAnswers,
    stats: {
      attempts: dataObject.stats?.attempts || 0,
      unlockCount: unlockedProfileIds.length,
    },
    responses: dataObject.stats?.responses,
    ...(unlockedProfileIds.length ? { legacyUnlockedProfileIds: unlockedProfileIds } : {}),
  });
};

export const migrateLegacyToDropsMap = (dataObject: UnlockDataObject): DropsMap => {
  const drop = migrateLegacyToDrop(dataObject);
  return { [drop.id]: drop };
};

/**
 * Zero every drop's engagement data, keeping all configuration. Returns dotted-path updates for
 * `updateDataObject`.
 */
export const buildStatsResetUpdates = (drops: DropsMap | undefined, assetId: string): Record<string, any> => {
  const updates: Record<string, any> = { statsOwnerAssetId: assetId };

  for (const dropId of Object.keys(drops || {})) {
    updates[`drops.${dropId}.stats`] = { attempts: 0, unlockCount: 0 };
    updates[`drops.${dropId}.responses`] = {};
    updates[`drops.${dropId}.legacyUnlockedProfileIds`] = [];
  }

  return updates;
};
