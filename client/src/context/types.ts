export const SET_HAS_SETUP_BACKEND = "SET_HAS_SETUP_BACKEND";
export const SET_INTERACTIVE_PARAMS = "SET_INTERACTIVE_PARAMS";
export const SET_GAME_STATE = "SET_GAME_STATE";
export const SET_ERROR = "SET_ERROR";
export const SET_VISITOR = "SET_VISITOR";
export const SET_UNLOCKED_THIS_SESSION = "SET_UNLOCKED_THIS_SESSION";

export type InteractiveParams = {
  assetId: string;
  displayName: string;
  identityId: string;
  interactiveNonce: string;
  interactivePublicKey: string;
  profileId: string;
  sceneDropId: string;
  uniqueName: string;
  urlSlug: string;
  username: string;
  visitorId: string;
};

export type UnlockType = "emote" | "accessory" | "badge";

export type QuestionType = "text" | "open_text" | "multiple_choice" | "all_that_apply";

export type DropState = "always" | "live" | "upcoming" | "ended";

export type UpcomingDisplay = "item" | "mystery";

export type AccessoryPreview = {
  id: string;
  name: string;
  previewUrl: string;
  category?: string;
};

/**
 * A drop as returned by GET /game-state — what the server decided this user may see. Answers are never included
 */
export interface DropType {
  id: string;
  state: DropState;
  unlockType: UnlockType;

  itemName?: string;
  itemPreviewUrl?: string;
  accessories?: AccessoryPreview[];

  itemDescription?: string;
  questionType?: QuestionType;
  options?: string[];
  unlockCount?: number;

  startDate?: string | null;
  endDate?: string | null;

  /** Non-Admin User facing only — the admin equivalents are `upcomingDisplay` and per-visitor claims. */
  mystery?: boolean;
  claimed?: boolean;
}

/** The four bands returned by GET /game-state. */
export type GameStateType = {
  upcoming?: DropType[];
  recentDrops?: DropType[];
  active?: DropType[];
  timezone?: string;
  today?: string;
};

/** What the user just won, keyed by drop id, for this drawer session only. */
export type SessionUnlock = {
  dropId: string;
  grantedNames?: string[];
  alreadyOwned?: boolean;
};

// ---- admin ----------------------------------------------------------------------------------

export type DropStats = {
  attempts: number;
  unlockCount: number;
};

export type DropResponse = {
  displayName: string;
  response: string;
  respondedAt: string;
};

/**
 * The full drop configuration as returned by GET /drops — admin-only, and unlike `DropType` it
 * includes the answer (`password` / `correctAnswers`).
 *
 * Inherits `id`, `state`, `unlockType`, `itemName`, `itemPreviewUrl`, `itemDescription`,
 * `questionType`, `options`, `startDate`, `endDate` and `accessories` from `DropType`, narrowing
 * `itemDescription` and `questionType` to required since a stored drop always has both.
 */
export interface AdminDropType extends DropType {
  itemId?: string;

  packId?: string;
  accessoryIds?: string[];

  badgeId?: string;
  badgeName?: string;
  badgeIcon?: string;

  itemDescription: string;
  questionType: QuestionType;

  password?: string;
  correctAnswers?: number[];

  showInUpcoming: boolean;
  upcomingDisplay: UpcomingDisplay;

  createdAt: string;
  updatedAt: string;

  stats: DropStats;
  responses?: { [profileId: string]: DropResponse };

  // Added by GET /drops for display.
  isConfigured?: boolean;
  resolvedItemName?: string;
  resolvedItemPreviewUrl?: string;
}

export type EmoteOption = {
  id: string;
  name: string;
  type: string;
  previewUrl: string;
};

export type AccessoryPackOption = {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  packId?: string;
  accessories: AccessoryPreview[];
};

export type BadgeOption = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

export type UnlockablesType = {
  emotes: EmoteOption[];
  packs: AccessoryPackOption[];
  badges: BadgeOption[];
};

export interface InitialState {
  error?: string;
  gameState?: GameStateType;
  hasInteractiveParams?: boolean;
  hasSetupBackend?: boolean;
  profileId?: string;
  unlockedThisSession?: { [dropId: string]: SessionUnlock };
  visitor?: {
    isAdmin: boolean;
  };
}

export type ActionType = {
  type: string;
  payload: InitialState & { sessionUnlock?: SessionUnlock };
};

export type ErrorType =
  | string
  | {
      message?: string;
      response?: { data?: { error?: { message?: string }; message?: string } };
    };
