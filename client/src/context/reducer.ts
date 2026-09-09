import {
  ActionType,
  InitialState,
  SET_ERROR,
  SET_GAME_STATE,
  SET_HAS_SETUP_BACKEND,
  SET_INTERACTIVE_PARAMS,
  SET_UNLOCKED_THIS_SESSION,
  SET_VISITOR,
} from "./types";

const globalReducer = (state: InitialState, action: ActionType) => {
  const { type, payload } = action;
  switch (type) {
    case SET_INTERACTIVE_PARAMS:
      return {
        ...state,
        hasInteractiveParams: true,
        profileId: payload.profileId,
      };
    case SET_HAS_SETUP_BACKEND:
      return {
        ...state,
        ...payload,
        hasSetupBackend: true,
      };
    case SET_GAME_STATE:
      return {
        ...state,
        ...payload,
        error: "",
      };
    case SET_UNLOCKED_THIS_SESSION: {
      // Accumulates for the life of this drawer mount. The server already omits claimed drops from
      // the active band on the next open, so nothing needs to persist beyond it.
      const sessionUnlock = payload.sessionUnlock;
      if (!sessionUnlock) return state;

      return {
        ...state,
        unlockedThisSession: {
          ...state.unlockedThisSession,
          [sessionUnlock.dropId]: sessionUnlock,
        },
        error: "",
      };
    }
    case SET_ERROR:
      return {
        ...state,
        error: payload?.error,
      };
    case SET_VISITOR:
      return {
        ...state,
        visitor: payload.visitor,
      };
    default: {
      throw new Error(`Unhandled action type: ${type}`);
    }
  }
};

export { globalReducer };
