import { Drop, DropState, QuestionType, UnlockType } from "../../types/index.js";

export interface AccessoryPreview {
  id: string;
  name: string;
  previewUrl: string;
  category?: string;
}

export type AccessoryLookup = Map<string, AccessoryPreview>;

/** What a non-admin is allowed to know about a drop. Built only by `cleanDrop`. */
export interface DropType {
  id: string;
  state: DropState;
  unlockType: UnlockType;

  /** Absent for mystery drops. */
  itemName?: string;
  itemPreviewUrl?: string;
  /** Individual accessory thumbnails, for accessory drops. */
  accessories?: AccessoryPreview[];

  /** Live / always-available only. */
  itemDescription?: string;
  questionType?: QuestionType;
  options?: string[];
  unlockCount?: number;

  startDate?: string | null;
  endDate?: string | null;

  /** Upcoming only — the item is deliberately withheld. */
  mystery?: boolean;
  /** Whether this visitor has unlocked the drop. Set on live, always-available and ended drops. */
  claimed?: boolean;
}

export const DEFAULT_ICONS: Record<UnlockType, string> = {
  emote: "/default-emote-icon.svg",
  accessory: "/default-accessory-icon.svg",
  badge: "/default-badge-icon.svg",
};

export const buildAccessoryLookup = (inventoryItems: any[]): AccessoryLookup => {
  const lookup: AccessoryLookup = new Map();

  for (const item of inventoryItems || []) {
    if (item?.type !== "ACCESSORY") continue;
    lookup.set(item.id, {
      id: item.id,
      name: item.metadata?.displayName || item.name || "Accessory",
      previewUrl: item.image_path || DEFAULT_ICONS.accessory,
      category: item.metadata?.category || "",
    });
  }

  return lookup;
};

/** The display name and preview image for a drop's reward, by unlock type. */
export const resolveDropItem = (drop: Drop, accessoryLookup?: AccessoryLookup) => {
  const fallbackIcon = DEFAULT_ICONS[drop.unlockType] || DEFAULT_ICONS.emote;

  const accessories = (drop.accessoryIds || [])
    .map((id) => accessoryLookup?.get(id))
    .filter(Boolean) as AccessoryPreview[];

  if (drop.unlockType === "badge") {
    return { itemName: drop.badgeName || "Badge", itemPreviewUrl: drop.badgeIcon || fallbackIcon, accessories: [] };
  }

  if (drop.unlockType === "accessory") {
    return {
      itemName: drop.itemName || "Accessories",
      itemPreviewUrl: drop.itemPreviewUrl || fallbackIcon,
      accessories,
    };
  }

  return { itemName: drop.itemName || "Emote", itemPreviewUrl: drop.itemPreviewUrl || fallbackIcon, accessories: [] };
};

/**
 * Reduce a drop to what the requesting non-admin may see, based on its state.
 *
 * `password` and `correctAnswers` never leave this function, and neither does the item identity of a
 * mystery drop or anything at all about an untagged upcoming drop. Every non-admin-facing response must
 * go through here — returning raw drops would leak answers.
 *
 * Returns null when the non-admin should not see the drop at all.
 */
export const cleanDrop = ({
  drop,
  state,
  claimed,
  accessoryLookup,
}: {
  drop: Drop;
  state: DropState;
  claimed?: boolean;
  accessoryLookup?: AccessoryLookup;
}): DropType | null => {
  const { itemName, itemPreviewUrl, accessories } = resolveDropItem(drop, accessoryLookup);

  const base = { id: drop.id, state, unlockType: drop.unlockType };

  if (state === "upcoming") {
    // An untagged upcoming drop must not appear anywhere until it goes live.
    if (!drop.showInUpcoming) return null;

    if (drop.upcomingDisplay === "mystery") {
      // Type and dates only — no name, no preview, no question.
      return { ...base, mystery: true, startDate: drop.startDate, endDate: drop.endDate };
    }

    return { ...base, itemName, itemPreviewUrl, startDate: drop.startDate, endDate: drop.endDate };
  }

  if (state === "ended") {
    // The name is needed for the greyed thumbnail's tooltip, including for drops that were a mystery
    // while upcoming — once it's over, there's nothing left to withhold.
    return { ...base, itemName, itemPreviewUrl, endDate: drop.endDate, claimed: !!claimed };
  }

  // live | always — the full challenge, minus the answer.
  //
  // Claimed drops stay in the band rather than being dropped: the client renders them as a success
  // card so the users can always see what they own. An always-available drop never ends, so if it
  // were removed here it would leave every band and vanish from the app entirely.
  return {
    ...base,
    itemName,
    itemPreviewUrl,
    accessories: drop.unlockType === "accessory" ? accessories : undefined,
    itemDescription: drop.itemDescription,
    questionType: drop.questionType,
    options:
      drop.questionType === "multiple_choice" || drop.questionType === "all_that_apply" ? drop.options : undefined,
    unlockCount: drop.stats?.unlockCount || 0,
    startDate: drop.startDate,
    endDate: drop.endDate,
    claimed: !!claimed,
  };
};
