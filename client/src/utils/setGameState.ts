import { ActionType, GameStateType, SessionUnlock, SET_GAME_STATE, SET_UNLOCKED_THIS_SESSION } from "@/context/types";
import { Dispatch } from "react";

export const setGameState = (dispatch: Dispatch<ActionType> | null, gameState: GameStateType) => {
  if (!dispatch || !gameState) return;

  dispatch({
    type: SET_GAME_STATE,
    payload: { gameState, error: "" },
  });
};

/**
 * Record a win for this drawer session. The active band is deliberately left untouched so the
 * claimed card flips to a success card in place, rather than jumping position or disappearing.
 */
export const addSessionUnlock = (dispatch: Dispatch<ActionType> | null, sessionUnlock: SessionUnlock) => {
  if (!dispatch) return;

  dispatch({
    type: SET_UNLOCKED_THIS_SESSION,
    payload: { sessionUnlock },
  });
};
