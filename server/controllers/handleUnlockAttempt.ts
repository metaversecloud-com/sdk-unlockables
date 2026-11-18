import { Request, Response } from "express";
import {
  buildClaimLockId,
  DEFAULT_TIMEZONE,
  errorHandler,
  evaluateAnswer,
  getCredentials,
  getDroppedAsset,
  getClaimGeneration,
  getDropState,
  getVisitor,
  getVisitorClaims,
  grantDropReward,
  hasClaimedDrop,
  isDropClaimable,
  isDropConfigured,
  recordVisitorClaim,
  rollBackClaimReservation,
  todayInTimezone,
} from "../utils/index.js";

const statusOf = (error: any): number | undefined => error?.status || error?.statusCode;

export const handleUnlockAttempt = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, displayName, profileId, urlSlug } = credentials;
    const { dropId, password, selectedAnswers } = req.body;

    if (!dropId) return res.status(400).json({ success: false, message: "Missing dropId" });
    // The claim is keyed by profile; without one a player could never be deduplicated.
    if (!profileId) return res.status(400).json({ success: false, message: "Missing profileId" });

    const droppedAsset = await getDroppedAsset(credentials);
    const dataObject = droppedAsset.dataObject;
    const drop = dataObject.drops?.[dropId];

    if (!drop) return res.status(404).json({ success: false, message: "That challenge no longer exists." });
    if (!isDropConfigured(drop)) {
      return res.status(400).json({ success: false, message: "This challenge isn't ready yet." });
    }

    // The window is re-checked here, not just in the feed: a client could post the id of an upcoming
    // or ended drop to claim it outside its window.
    const today = todayInTimezone(dataObject.timezone || DEFAULT_TIMEZONE);
    const state = getDropState(drop, today);
    if (!isDropClaimable(state)) {
      return res.status(400).json({ success: false, message: "This challenge isn't available right now." });
    }

    const visitor = await getVisitor(credentials);
    const claims = await getVisitorClaims(visitor, assetId);

    // Already claimed: never grant or count twice. This is the cheap path for a replayed request; it
    // can't catch two requests in flight at once, which the claim lock below handles.
    if (hasClaimedDrop(claims, drop, profileId)) {
      return res.json({ success: true, alreadyClaimed: true, dropId, message: "You've already unlocked this." });
    }

    const isCorrect = evaluateAnswer({ drop, password, selectedAnswers });
    const attemptsPath = `drops.${dropId}.stats.attempts`;
    const attemptedAnalytic = { analyticName: "unlock_attempted", profileId, uniqueKey: profileId, urlSlug };

    // Counters use the server-side atomic increment, never read-then-write: concurrent answers would
    // otherwise read the same value and lose updates.
    if (!isCorrect) {
      await droppedAsset.incrementDataObjectValue(attemptsPath, 1, {
        analytics: [attemptedAnalytic, { analyticName: "false_responses", profileId, uniqueKey: profileId, urlSlug }],
      });

      return res.status(400).json({ success: false, message: "Oops! That's not right. Try again!" });
    }

    // Reserve the claim before granting. The lock is never released (see buildClaimLockId), so of two
    // simultaneous correct submissions exactly one gets past here; the other is a duplicate of a claim
    // that is either done or in progress. The reservation write also counts this attempt.
    const generation = getClaimGeneration(visitor, assetId, dropId);
    try {
      await droppedAsset.incrementDataObjectValue(attemptsPath, 1, {
        analytics: [attemptedAnalytic],
        lock: { lockId: buildClaimLockId(dropId, profileId, generation) },
      });
    } catch (error: any) {
      if (statusOf(error) === 409) {
        return res.json({ success: true, alreadyClaimed: true, dropId, message: "You've already unlocked this." });
      }
      throw error;
    }

    let grantResult;
    try {
      grantResult = await grantDropReward({ credentials, visitor, drop });
    } catch (error) {
      // Nothing was granted: free the claim so the player can try again, and record/count nothing.
      await rollBackClaimReservation(visitor, assetId, dropId, generation);
      throw error;
    }
    const { alreadyOwned, grantedNames, backfillPatch } = grantResult;

    const successAnalytics = [
      { analyticName: "completions", profileId, uniqueKey: profileId, urlSlug },
      { analyticName: "unlock_succeeded", profileId, uniqueKey: profileId, urlSlug },
    ];

    // A reward the player already owned is not a new unlock: no unlockCount, no `<type>_granted`.
    if (!alreadyOwned) {
      await droppedAsset.incrementDataObjectValue(`drops.${dropId}.stats.unlockCount`, 1, {
        analytics: [
          ...successAnalytics,
          { analyticName: `${drop.unlockType}_granted`, profileId, uniqueKey: profileId, urlSlug },
        ],
      });
    }

    // Plain field writes only (no counters), so no lock is needed. Any cross-ecosystem self-heal patch
    // (see `resolveInventoryItem` + `grantDropReward`) rides along with the open-text response, and the
    // already-owned path's analytics ride on this write instead of the skipped increment.
    const dataUpdate: Record<string, any> = { ...backfillPatch };
    if (drop.questionType === "open_text" && password) {
      dataUpdate[`drops.${dropId}.responses.${profileId}`] = {
        displayName,
        response: password.trim(),
        respondedAt: new Date().toISOString(),
      };
    }
    if (alreadyOwned || Object.keys(dataUpdate).length) {
      await droppedAsset.updateDataObject(dataUpdate, { analytics: alreadyOwned ? successAnalytics : [] });
    }

    // Recorded even when already owned, so the challenge stops reappearing for this visitor.
    await recordVisitorClaim(visitor, assetId, dropId);

    return res.json({ success: true, dropId, alreadyOwned, grantedNames });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleUnlockAttempt",
      message: "Error attempting to unlock item",
      req,
      res,
    });
  }
};
