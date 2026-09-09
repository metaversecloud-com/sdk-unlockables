import { Drop, QuestionType, UnlockType } from "../../types/index.js";
import { createDrop } from "./migrateToV2.js";

export interface DropInput {
  unlockType?: UnlockType;

  itemId?: string;
  itemName?: string;
  itemPreviewUrl?: string;

  packId?: string;
  accessoryIds?: string[];

  badgeId?: string;
  badgeName?: string;
  badgeIcon?: string;

  itemDescription?: string;

  questionType?: QuestionType;
  password?: string;
  options?: string[];
  correctAnswers?: number[];

  alwaysAvailable?: boolean;
  startDate?: string | null;
  endDate?: string | null;

  showInUpcoming?: boolean;
  upcomingDisplay?: "item" | "mystery";
}

const cleanDate = (value?: string | null): string | null => (value && value.trim() ? value.trim() : null);

/**
 * Normalise an admin submission into a stored Drop.
 *
 * Only the fields belonging to the chosen unlock type and question type are carried over, and the
 * caller writes the whole `drops.<id>` object — so switching a drop from accessory to badge, or from
 * multiple choice to open response, leaves no stale item ids or orphaned correct answers behind.
 *
 * Engagement data and `createdAt` are preserved from the existing drop: editing a live drop must
 * never revoke or reset what students have already earned.
 */
export const buildDropFromInput = ({ input, existing }: { input: DropInput; existing?: Drop }): Drop => {
  const unlockType: UnlockType = input.unlockType || existing?.unlockType || "emote";
  const questionType: QuestionType = input.questionType || "text";

  const item: Partial<Drop> = {};
  if (unlockType === "emote") {
    item.itemId = input.itemId;
    item.itemName = input.itemName;
    item.itemPreviewUrl = input.itemPreviewUrl;
  } else if (unlockType === "accessory") {
    item.packId = input.packId;
    item.accessoryIds = input.accessoryIds || [];
    item.itemName = input.itemName;
    item.itemPreviewUrl = input.itemPreviewUrl;
  } else {
    item.badgeId = input.badgeId;
    item.badgeName = input.badgeName;
    item.badgeIcon = input.badgeIcon;
  }

  const answer: Partial<Drop> = {};
  if (questionType === "text") {
    answer.password = input.password?.toString().trim().toLowerCase();
  } else if (questionType === "multiple_choice" || questionType === "all_that_apply") {
    answer.options = (input.options || []).map((option) => option?.toString().trim() ?? "");
    answer.correctAnswers = (input.correctAnswers || []).map(Number);
  }

  const alwaysAvailable = input.alwaysAvailable === true;

  const base = existing || createDrop();

  return {
    ...base,
    id: base.id,
    unlockType,
    // Wipe every type-specific field, then apply only the ones for the chosen type.
    itemId: undefined,
    itemName: undefined,
    itemPreviewUrl: undefined,
    packId: undefined,
    accessoryIds: undefined,
    badgeId: undefined,
    badgeName: undefined,
    badgeIcon: undefined,
    password: undefined,
    options: undefined,
    correctAnswers: undefined,
    ...item,
    ...answer,
    itemDescription: input.itemDescription?.toString() ?? "",
    questionType,
    startDate: alwaysAvailable ? null : cleanDate(input.startDate),
    endDate: alwaysAvailable ? null : cleanDate(input.endDate),
    showInUpcoming: input.showInUpcoming === true,
    upcomingDisplay: input.upcomingDisplay === "mystery" ? "mystery" : "item",
    createdAt: base.createdAt,
    updatedAt: new Date().toISOString(),
    stats: base.stats || { attempts: 0, unlockCount: 0 },
    responses: base.responses,
    legacyUnlockedProfileIds: base.legacyUnlockedProfileIds,
  };
};
