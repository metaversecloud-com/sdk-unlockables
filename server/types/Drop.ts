export type UnlockType = "emote" | "accessory" | "badge";

export type QuestionType = "text" | "open_text" | "multiple_choice" | "all_that_apply";

export type UpcomingDisplay = "item" | "mystery";

/**
 * Derived from the drop's date window and today's date in the instance timezone.
 * Never stored — always computed server-side.
 */
export type DropState = "always" | "live" | "upcoming" | "ended";

export interface DropStats {
  attempts: number;
  unlockCount: number;
}

export interface DropResponse {
  displayName: string;
  response: string;
  respondedAt: string;
}

export interface Drop {
  id: string;
  unlockType: UnlockType;

  // emote
  itemId?: string;
  itemName?: string;
  itemPreviewUrl?: string;

  // accessory
  packId?: string;
  accessoryIds?: string[];

  // badge
  badgeId?: string;
  badgeName?: string;
  badgeIcon?: string;

  itemDescription: string;

  questionType: QuestionType;
  password?: string;
  options?: string[];
  correctAnswers?: number[];

  /** Date-only (YYYY-MM-DD). Both absent = always available. endDate is inclusive. */
  startDate?: string | null;
  endDate?: string | null;

  showInUpcoming: boolean;
  upcomingDisplay: UpcomingDisplay;

  createdAt: string;
  updatedAt: string;

  stats: DropStats;

  responses?: { [profileId: string]: DropResponse };

  /**
   * Set only by the v1 -> v2 migration, never written afterwards. Preserves the per-profile claims
   * from the legacy `stats.successfulUnlocks` map so users who already unlocked the original
   * single challenge don't see it reappear. Read alongside the visitor's claim record.
   */
  legacyUnlockedProfileIds?: string[];
}

export interface DropsMap {
  [dropId: string]: Drop;
}

/** The dropped asset data object at schemaVersion 2, plus still-readable legacy fields. */
export interface UnlockDataObject {
  schemaVersion?: number;
  timezone?: string;
  /** The asset id the stats belong to. A mismatch means the asset was copied — zero the stats. */
  statsOwnerAssetId?: string;
  drops?: DropsMap;

  // ---- legacy (v1) shape: read by the migration, never written again ----
  unlockType?: string;
  itemId?: string;
  itemName?: string;
  itemPreviewUrl?: string;
  itemDescription?: string;
  packId?: string;
  accessoryIds?: string[];
  emoteId?: string;
  emoteName?: string;
  emotePreviewUrl?: string;
  emoteDescription?: string;
  questionType?: string;
  password?: string;
  options?: string[];
  correctAnswers?: number[];
  stats?: {
    attempts?: number;
    successfulUnlocks?: { [profileId: string]: { unlockedAt: string; displayName?: string } };
    responses?: { [profileId: string]: DropResponse };
  };
}
